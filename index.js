#!/usr/bin/env node

const Mqtt = require('mqtt')
const pkg = require('./package.json')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const avr_factory = require('alt-denonavr')
const avr = new avr_factory()

const AVR_IP = process.env.AVR_IP

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
    var translatedInput = input
    switch (input) {
        case 'SAT':
        case 'CBL':
            translatedInput = "SAT/CBL"

        default:
    }

    return _.upperCase(translatedInput)
}

avr.init((state) => {
    Object.keys(state).forEach(key => {
        const value = state[key]
        if (key == 'unknown') {
            return
        }

        publish(key, value)
    });
}, 'AVR-X6400H', AVR_IP)

async function processIncomingMQTT(inTopic, inPayload) {
    try {
        // アンプの電源ON/OFF
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
                        logging.info(' => changing input: ' + inPayload)
                        const inputString = translateInput(inPayload)
                        await avr.setInput(inputString)
                        break

                    case 'volume':
                        logging.info(' => changing volume: ' + inPayload)
                        await avr.setVolume(Number(inPayload))
                        break

                    case 'power':
                        logging.info(' => changing power: ' + inPayload)
                        if (inPayload == '0')
                            await avr.off()
                        else
                            await avr.on()
                        break

                    case 'mute':
                        logging.info(' => changing mute: ' + inPayload)
                        await avr.setMute(inPayload == '0' ? false : true)
                        break

                    default:
                        logging.error('unhandled request: ' + inTopic)
                }
        }
    } catch (e) {
        logging.error('processIncomingMQTT Error: ' + e);
    }

    // try {
    //     // アンプの電源ON/OFF
    //     await avr.on();
    //     await avr.off();
    //     // マスターボリューム変更
    //     await avr.setVolume(20);
    //     // ミュート
    //     await avr.setMute(true);
    //     // 入力切換
    //     await avr.setInput('SAT/CBL');
    //     // ダイナミックボリューム変更
    //     await avr.setDynaminVolume('MED');
    //     const result = await avr.getDynamicVolume(); // => MED
    // } catch (e) {
    //     console.error(e);
    // }
}