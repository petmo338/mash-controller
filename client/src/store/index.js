/* eslint-disable no-console */
import Vue from 'vue'
import Vuex from 'vuex'
import http from 'http'
import { string } from 'postcss-selector-parser'
import axios from 'axios'

Vue.use(Vuex)
const API_HOST = '192.168.30.175'
const store = new Vuex.Store({
  state: {
    currentTemp: -1,
    tempSetpoint: 67,
    powerSetpoint: 0,
    currentPower: 0,
    element1800: 'Off',
    element1200: 'Off',
    timeUTC: undefined,
    hostname: ''
  },
  mutations: {
    setTempSetpoint (state, temp) {
      state.tempSetpoint = temp
    },
    setCurrentTemp (state, temp) {
      state.currentTemp = temp
    },
    setCurrentPower (state, power) {
        state.currentPower = power
    },
    setElement1800 (state, onOff) {
      if (onOff === 1) {
        state.element1800 = 'On'
      } else {
        state.element1800 = 'Off'
      }
    },
    setElement1200 (state, onOff) {
      if (onOff === 1) {
        state.element1200 = 'On'
      } else {
        state.element1200 = 'Off'
      }
    },
    setHostname (state, hostname) {
      state.hostname = hostname
    },
    setPowerSetpoint (state, power) {
      state.powerSetpoint = power
    },
    setTimeUTC (state, time) {
      state.timeUTC = time
    }    
  },
  actions: {
    setTempSetpoint (value) {
      updateController('setTempSetpoint', value)
    },
    setPowerSetpoint (value) {
      updateController('setPowerSetpoint', value)
    },
    getAll ({ commit}) {
      // Make a request for a user with a given ID
      axios.get('http://' + API_HOST + ':9000/')
      .then(function (response) {
        if (response.data.hostname) {
          commit('setHostname', response.data.hostname)
        }
        if (response.data.timeUTC) {
          commit('setTimeUTC', response.data.timeUTC)
        }
        if (response.data.tempSetpoint) {
          commit('setTempSetpoint', response.data.tempSetpoint)
        }
        if (response.data.currentTemp) {
          commit('setCurrentTemp', response.data.currentTemp.bottom)
        }
        if (response.data.heatStatus) {
          commit('setElement1800', response.data.heatStatus.element1800)
          commit('setElement1200', response.data.heatStatus.element1200)
        }
        if (response.data.power) {
          commit('setPowerSetpoint', response.data.power)
        }
        
      //   {
      //     "hostname": "raspberrypi",
      //     "timeUTC": "2020-05-22T12:15:03.000Z",
      //     "tempSetpoint": 67,
      //     "currentTemp": {
      //         "bottom": 20.75
      //     },
      //     "heatStatus": {
      //         "element1800": 0,
      //         "element1200": 0
      //     },
      //     "power": 0,
      //     "extra": "blah"
      // }

        // handle success
        console.log(response)
      })
      .catch(function (error) {
        // handle error
        console.log(error)
      })
      .then(function () {
        // always executed
      })
    },
    getTemp ({ commit }) {
      commitAPIFloat(commit, '/currentTemp', 'currentTemp1', 'currTemp')
    },
    getSetpoint ({ commit}) {
      commitAPIFloat(commit, '/setPoint', 'setPoint1', 'setTemp')
    }
  },
  modules: {
  }
})

async function updateController(action, value) {
  let endpoint = ''
  let data = undefined
  if (action === 'setTempSetpoint') {
    endpoint = '/setTempSetpoint'
    data = { 'tempSetpoint': value}
  } else if (action === 'setPowerSetpoint') {
    endpoint = '/setPowerSetpoint'
    data = { 'power': value}
  }
  axios.post(endpoint, data)
  .then(function (response) {
    if (response.status >= 300) {
      console.log('Error: ' + response)
    }
  })
  .catch(function (error) {
    // handle error
    console.log(error)
  })
}



async function commitAPIFloat(commit, endpoint, valueName, storeName) {
  // console.log(valueName)
  const options = {
    hostname: 'localhost',
    port: 9000,
    path: endpoint,
    method: 'GET',
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*'
    }
  }
  
  const req = http.request(options, res => {
    // console.log(`statusCode: ${res.statusCode}`)
    // console.log(res)
    res.on('data', d => {
      console.log(JSON.parse(d))
      let value = parseFloat(JSON.parse(d)[valueName])
      if (!isNaN(value)) {
        commit(storeName, value)
      } else {
        console.error('Unparseable float (' + string(valueName) + '): ' + d[valueName])
      }
    })
  })
  
  req.on('error', error => {
    console.error(error)
  })
  
  req.end()
  return undefined
}

export default store

// setInterval(function () {
//   store.commit('currTemp', store.state.setpoint -0.5 + Math.random())
// }, 250)
setInterval(function () {
  store.dispatch('getAll')
}, 2000)
