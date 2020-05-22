<template>
  <section>
    <p>
        <b-field label="Set Temperature">
          <b-numberinput v-model="tempSetpoint" step="0.5" min="25.0" max="100.0" rounded></b-numberinput>
        </b-field>
    <p>
    <p>Current temp = {{ currTemp }}</p>
    <p>Current power = {{ currPower }}</p>   
    <p>temp setpoint = {{ tempSetpoint }}</p>
    <p>power setpoint = {{ powerSetpoint }}</p>
    <p>Element 1800 = {{ element1800 }}</p>
    <p>Element 1200 = {{ element1200 }}</p>
        
  </section>
</template>

<script>
export default {
  // methods: {
  //   setTemp() {
  //     this.$store.commit('setTemp', this.setpoint.value)
  //   }
  // },
  name: 'Monitor',
  mounted: function () {
    this.$store.dispatch('getAll')
  },
  computed: {
    currTemp: function () {
      return this.$store.state.currentTemp
    },
    currPower: function () {
      return this.$store.state.currentPower
    },
    element1800: function () {
      return this.$store.state.element1800
    },
    element1200: function () {
      return this.$store.state.element1200
    },
    tempSetpoint: {
      get () {
        return this.$store.state.tempSetpoint
      },
      set (value) {
        this.$store.dispatch('setTempSetpoint', value)
      }
    },
    powerSetpoint: {
      get () {
        return this.$store.state.powerSetpoint
      },
      set (value) {
        this.$store.dispatch('setPowerSetpoint', value)
      }
    }

  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
