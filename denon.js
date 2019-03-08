const Denon = require('denon-client')
const _ = require('lodash')
const logging = require('homeautomation-js-lib/logging.js')

// Set your IP here
const AVR_IP = process.env.AVR_IP
const AVR_PORT = process.env.AVR_PORT

const mqttOptions = {retain: true, qos: 1}


if (_.isNil(AVR_IP)) {
	logging.error('AVR_IP not set, not starting')
	process.abort()
}


if (_.isNil(AVR_PORT)) {
	logging.error('AVR_PORT not set, not starting')
	process.abort()
}


const denonClient = new Denon.DenonClient(AVR_IP, AVR_PORT)

const denonPowerCommands = {
	'1': Denon.Options.PowerOptions.On,
	'0': Denon.Options.PowerOptions.Standby
}

const denonVolumeCommands = {
	'up': Denon.Options.VolumeOptions.Up,
	'down': Denon.Options.VolumeOptions.Down
}

const denonMuteCommands = {
	'mute_on': Denon.Options.MuteOptions.On,
	'mute_off': Denon.Options.MuteOptions.Off
}

const denonInputCommands = {
	'tv': Denon.Options.InputOptions.TV,
	'ipod': Denon.Options.InputOptions.IPod,
	'usb': Denon.Options.InputOptions.USB,
	'net': Denon.Options.InputOptions.Net,
	'vdp': Denon.Options.InputOptions.VDP,
	'mxport': Denon.Options.InputOptions.MXPort,
	'mplay': Denon.Options.InputOptions.MPlay,
	'aux1': Denon.Options.InputOptions.Aux1,
	'game': Denon.Options.InputOptions.Game,
	'media': Denon.Options.InputOptions.MediaPlayer,
	'cable': Denon.Options.InputOptions.Cable,
	'sattelite': Denon.Options.InputOptions.Sattalite,
	'bd': Denon.Options.InputOptions.BD,
	'dvd': Denon.Options.InputOptions.DVD,
	'tuner': Denon.Options.InputOptions.TUNER,
	'cd': Denon.Options.InputOptions.CD
}



const performDenonCommand = function(functionName) {
	denonClient
		.connect()
		.then(() => {
			return functionName()
		})
		.catch((error) => {
			console.error(error)
		})
    
	return true
}


module.exports.performDenonPowerCommand = function(name) {
	denonClient.connect()
	const value = denonPowerCommands[name]

	if (!_.isNil(value)) {
		if ( value == Denon.Options.PowerOptions.On ) {
			return performDenonCommand( function(){
				return denonClient.setZone1(Denon.Options.PowerOptions.On)
			})
		} else {
			return performDenonCommand( function(){
				return denonClient.setPower(Denon.Options.PowerOptions.Standby)
			})
		}
	}

	return false
}

module.exports.performDenonVolumeCommand = function(name) {
	denonClient.connect()
	const value = denonVolumeCommands[name]

	if (!_.isNil(value)) {
		return performDenonCommand( function(){
			return denonClient.setVolume(value)
		})
	}

	return false
}

module.exports.performDenonMuteCommand = function(name) {
	denonClient.connect()

	if (name === 'toggle') {
		denonClient.getMute().then((isMuted) => {
			logging.info('is muted: ' + isMuted)
			if (isMuted == 'OFF') {
				module.exports.onButtonPressed('mute_on')
			} else {
				module.exports.onButtonPressed('mute_off') 
			}

		})
		return true

	} else {
		const value = denonMuteCommands[name]

		if (!_.isNil(value)) {
			return performDenonCommand( function(){
				denonClient.setMute(value)
			})
		}
	}
	return false
}

module.exports.performDenonInputCommand = function(name) {
	const value = denonInputCommands[name]

	denonClient.connect()

	if (!_.isNil(value)) {
		return performDenonCommand( function(){
			denonClient.setInput(value)
		})
	}

	return false
}


var mqttClient = null
var mqttTopic = null

const publish = function(name, value) {
	if ( !_.isNil(mqttClient) ) {
		if (_.isNil(value)) {
			value = '0'
		}
        
		if ( value == 'OFF' ) {
			value = '0'
		} else if ( value == 'STANDBY' ) {
			value = '0'
		} else if ( value == 'ON' ) {
			value = '1'
		}
        
		value = value.toString().toLowerCase()
        
		mqttClient.smartPublish(mqttTopic + '/' + name, value.toString(), mqttOptions)
	}
}

module.exports.setMQTTClient = function onButtonPressed(client, topic) {
	mqttClient = client
	mqttTopic = topic
	denonClient.connect()
}

/* Matrix Controller */

module.exports.onButtonPressed = function onButtonPressed(name) {
	logging.info(`[DENON CONTROLLER] ${name} button pressed`)

	denonClient.connect()

	var success = this.performDenonPowerCommand(name)
	if (!success) { 
		success = this.performDenonVolumeCommand(name)
	}
	if (!success) {
		success = this.performDenonMuteCommand(name)
	}
	if (!success) { 
		success = this.performDenonInputCommand(name)
	}

	if (!success) {
		logging.info('unhandled button press: ' + name)
	}
}

denonClient.on('masterVolumeChanged', (volume) => {
	logging.info(`Volume changed to: ${volume}`)
	publish('volume', volume)
})

denonClient.on('muteChanged', (muteChanged) => {
	logging.info(`muteChanged changed to: ${muteChanged}`)
	publish('mute', muteChanged)
})

denonClient.on('inputChanged', (inputChanged) => {
	logging.info(`inputChanged changed to: ${inputChanged}`)
	publish('input', inputChanged)
})

denonClient.on('powerChanged', (powerChanged) => {
	logging.info(`powerChanged changed to: ${powerChanged}`)
	publish('power', powerChanged)
})
