<template>
  <div>
    <v-menu top v-model="menu" offset-y>
      <!-- eslint-disable-next-line vue/no-unused-vars -->
      <template #activator="{ on }">
        <v-btn text dense small @click="activate(on)" v-if="currentDevice">
          Serial: {{deviceName}}
        </v-btn>
        <v-btn text dense small @click="activate" v-else>Select Device Port</v-btn>
      </template>
      <v-list dense :style="{ padding: '0' }">
        <v-list-item
          v-for="device in devices"
          :key="device.value"
          @click="$serial.setCurrentDevice(device.value)"
        >
          <v-list-item-title>{{device.name}}</v-list-item-title>
        </v-list-item>
        <v-divider v-if="devices.length" />
        <v-list-item
          v-if="$serial.requestRequired"
          @click="$serial.requestDevice()"
        >
          <v-list-item-title>
            <v-icon left>mdi-plus</v-icon>
            Add New Device
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="$serial.currentDevice"
          @click="$serial.reconnect()"
        >
          <v-list-item-title>
            <v-icon left>mdi-refresh</v-icon>
            Reconnect
          </v-list-item-title>
        </v-list-item>
        <v-list-item
          v-if="$serial.currentDevice"
          @click="$serial.clearCurrentDevice()"
        >
          <v-list-item-title>
            <v-icon left>mdi-close</v-icon>
            Reset
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <status-bubble v-if="currentDevice" :status="status"/>
  </div>
</template>

<script>
import StatusBubble from './status-bubble.vue';

export default {
  components: {
    StatusBubble,
  },
  data() {
    return {
      menu: false,
      devices: [],
      currentDevice: (this.$serial && this.$serial.currentDevice) || null,
      status: this.$serial && this.$serial.status,
      deviceCB: null,
      statusCB: null,
    };
  },
  computed: {
    deviceName() {
      if (!this.currentDevice) return '';
      return (this.devices.find((d) => d.value === this.currentDevice) || {
        name: this.$serial.handlesSelect ? 'Selected' : 'Unknown',
      }).name;
    },
  },
  watch: {
    async menu(v) {
      if (v) this.devices = await this.$serial.listDevices();
    },
  },
  mounted() {
    this.currentDevice = this.$serial.currentDevice || null;
    this.status = this.$serial.status;
    this.deviceCB = (value) => { this.currentDevice = value; };
    this.statusCB = (value) => { this.status = value; };
    this.$serial.on('currentDevice', this.deviceCB);
    this.$serial.on('status', this.statusCB);
  },
  beforeDestroy() {
    if (this.deviceCB) this.$serial.off('currentDevice', this.deviceCB);
    if (this.statusCB) this.$serial.off('status', this.statusCB);
  },
  methods: {
    activate() {
      if (this.$serial.handlesSelect) {
        this.$serial.requestDevice();
      } else {
        this.menu = true;
      }
    },
  },
};
</script>
