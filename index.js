#!/usr/bin/env node

const Mqtt = require('mqtt')
const pkg = require('./package.json')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const Denon = require('denon-client');
const queryInterval = 10

const AVR_IP = process.env.AVR_IP

var isConnectedToDenon = false
var topic_prefix = process.env.TOPIC_PREFIX
var mqttConnected = false
const mqttOptions = { retain: true, qos: 1 }

if (_.isNil(topic_prefix)) {
    logging.error('TOPIC_PREFIX not set, not starting')
    process.abort()
}

if (_.isNil(AVR_IP)) {
    logging.error('AVR_IP not set, not starting')
    process.abort()
}

logging.info(pkg.name + ' ' + pkg.version + ' starting')

const denonClient = new Denon.DenonClient(AVR_IP);

const mqtt = mqtt_helpers.setupClient(function() {
    mqttConnected = true

    logging.info('mqtt subscribe: ' + topic_prefix + '/set/#')
    mqtt.subscribe(topic_prefix + '/set/#', { qos: 1 })
}, function() {
    if (mqttConnected) {
        mqttConnected = false
        logging.error('mqtt disconnected')
    }
})

mqtt.on('error', err => {
    logging.error('mqtt: ' + err)
})


mqtt.on('message', (inTopic, inPayload) => {
    processIncomingMQTT(inTopic, inPayload)
})


const publish = function(name, value) {
    if (!_.isNil(mqtt)) {
        if (_.isNil(value)) {
            value = '0'
        }

        if (value == 'OFF') {
            value = '0'
        } else if (value == 'STANDBY') {
            value = '0'
        } else if (value == 'ON') {
            value = '1'
        } else if (value == false) {
            value = '0'
        } else if (value == true) {
            value = '1'
        }

        value = value.toString().toLowerCase()

        mqtt.smartPublish(topic_prefix + '/' + name, value.toString(), mqttOptions)
    }
}

const translateInput = function(input) {
    var translatedInput = input.toString()

    switch (translatedInput) {
        case 'SAT':
        case 'CBL':
            translatedInput = 'SAT/CBL'

        default:
    }

    return translatedInput.toUpperCase()
}

const sendDenonCommand = function(commandBlock) {
    denonClient
    .connect()
    .then(() => {
      commandBlock()
    })
    .catch((error) => {
      logging.error('Connection error: ' + error)
    })
  
}

const connect = function() {
    if ( isConnectedToDenon ) return

    if ( denonClient)
    sendDenonCommand( function() {
        logging.info('Connection ping')
    })    
}

const startPoll = function() {
    logging.info('Starting to poll')
    interval(async() => {
        connect()
    }, queryInterval * 1000)

    connect()
}

startPoll()

async function processIncomingMQTT(inTopic, inPayload) {
    try {
        var command = null
        var topic = inTopic
        var payload = String(inPayload)
        logging.info('mqtt <' + topic + ':' + payload)

        if (topic[0] == '/') {
            topic = topic.substring(1)
        }

        const parts = topic.split('/')

        switch (parts[parts.length - 2]) {
            case 'set':
                switch (parts[parts.length - 1]) {
                    case 'input':
                        const inputString = translateInput(inPayload)
                        logging.info(' => changing input: ' + inputString)
                        command = function() {
                            denonClient.setInput(inputString)
                        }
                        break

                    case 'volume':
                        logging.info(' => changing volume: ' + inPayload)
                        command = function() {
                            denonClient.setVolume(Number(inPayload))
                        }
                        break

                    case 'power':
                        logging.info(' => changing power: ' + inPayload)

                        command = function() {
                            denonClient.setZone1(inPayload == '0' ? Denon.Options.Zone1Options.Off : Denon.Options.Zone1Options.On)
                        }
                        break

                    case 'mute':
                        logging.info(' => changing mute: ' + inPayload)
                        command = function() {
                            denonClient.setMute(inPayload == '0' ? Denon.Options.MuteOptions.Off : Denon.Options.MuteOptions.On)
                        }
                        break

                    default:
                        logging.error('unhandled request: ' + inTopic)
                }
        }
    } catch (e) {
        logging.error('processIncomingMQTT Error: ' + e);
    }

   if ( !_.isNil(command) ) {
        sendDenonCommand( command )       
   }
}


denonClient.on('connect', () => {
    logging.info('connected to denon')
    isConnectedToDenon = true
})
  
denonClient.on('close', () => {
    logging.error('connection closed')
    isConnectedToDenon = false
})
  
denonClient.on('error', (error) => {
    logging.error('connection error: ' + error)
    isConnectedToDenon = false
})
  
denonClient.on('displayDimChanged', (value) => {
    logging.info('displayDimChanged: ' + value)
    publish('dim', value)
})
  
denonClient.on('inputChanged', (value) => {
    logging.info('inputChanged: ' + value)
    publish('input', value)
})
  
denonClient.on('masterVolumeChanged', (value) => {
    logging.info('masterVolumeChanged: ' + value)
    publish('volume', value)
})
  
denonClient.on('masterVolumeMaxChanged', (value) => {
    logging.info('masterVolumeMaxChanged: ' + value)
    publish('max_volume', value)
})
  
denonClient.on('muteChanged', (value) => {
    logging.info('muteChanged: ' + value)
    publish('mute', value)
})
  
denonClient.on('powerChanged', (value) => {
    logging.info('powerChanged: ' + value)
    publish('power', value)
    publish('zone1', value)
})
  
denonClient.on('surroundChanged', (value) => {
    logging.info('surroundChanged: ' + value)
    publish('surround', value)
})
  
denonClient.on('zone1Changed', (value) => {
    logging.info('zone1Changed: ' + value)
    publish('zone1', value)
})
  
denonClient.on('zone2Changed', (value) => {
    logging.info('zone2Changed: ' + value)
    publish('zone2', value)
})
  
denonClient.on('zone3Changed', (value) => {
    logging.info('zone3Changed: ' + value)
    publish('zone3', value)
})
  
