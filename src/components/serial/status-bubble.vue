<template>
  <v-chip class="mx-1" small label :color="color">{{statusText}}</v-chip>
</template>

<script>
export default {
  props: ['status'],
  computed: {
    color() {
      switch (this.status) {
        case 'connected': return 'success';
        case 'connecting': return 'warning';
        default: return 'error';
      }
    },
    statusText() {
      switch (this.status) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting';
        case 'disconnected': return 'Disconnected';
        default: return 'Unknown';
      }
    },
  },
};
</script>
