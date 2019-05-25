#!/usr/bin/env node

const Mqtt = require('mqtt')
const pkg = require('./package.json')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')
const denon_commands = require('./denon.js')

const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')

var topic_prefix = process.env.TOPIC_PREFIX
var mqttConnected = false

if (_.isNil(topic_prefix)) {
	logging.error('TOPIC_PREFIX not set, not starting')
	process.abort()
}


logging.info(pkg.name + ' ' + pkg.version + ' starting')

const mqtt = mqtt_helpers.setupClient(function() {
	mqttConnected = true

	logging.info('mqtt subscribe: ' + topic_prefix + '/set/#')
	mqtt.subscribe(topic_prefix + '/set/#', {qos: 1})
	denon_commands.setMQTTClient(mqtt, topic_prefix)
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
					denon_commands.performDenonInputCommand(inPayload)
					break
                    
				case 'volume':
					logging.info(' => changing volume: ' + inPayload)
					denon_commands.performDenonVolumeCommand(inPayload)
					break
                    
				case 'power':
					logging.info(' => changing power: ' + inPayload)
					denon_commands.performDenonPowerCommand(inPayload)
					break
                    
				case 'mute':
					logging.info(' => changing mute: ' + inPayload)
					denon_commands.performDenonMuteCommand(inPayload)
					break

				default:
					logging.error('unhandled request: ' + inTopic)
			}
	}
})

