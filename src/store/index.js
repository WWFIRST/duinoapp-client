import Vue from 'vue';
import Vuex from 'vuex';
import feathersVuex from 'feathers-vuex';
import feathersClient from './feathers-client';

const { service, FeathersVuex } = feathersVuex(feathersClient, { idField: '_id' });

Vue.use(Vuex);
Vue.use(FeathersVuex);

Vue.use(Vuex);

const store = new Vuex.Store({
  state: {

  },
  mutations: {

  },
  actions: {

  },
  modules: {

  },

  plugins: [
    service('projects', {
      instanceDefaults: {
        name: '',
        ref: '',
        description: '',
        files: [],
        boards: [],
        libraries: [],
      },
    }),
    service('files', {
      instanceDefaults: {
        name: '',
        ref: '',
        content: '',
        localPath: null,
      },
    }),
    service('servers', {
      instanceDefaults: {
        name: 'Local Test Server',
        address: 'http://localhost:3000',
        location: 'Under Your Nose',
        owner: 'You',
        website: 'http://example.com/self-promotion.html',
        description: 'A compile server running on your local machine',
        ping: -1,
      },
    }),
    service('boards', {
      instanceDefaults: {
        name: '',
        fqbn: '',
        core: {
          name: '',
          version: '',
          id: '',
        },
        options: [],
        selected: {},
        servers: [],
      },
    }),
    service('libraries', {
      instanceDefaults: {
        name: '',
        releases: {},
        version: 'latest',
        enabled: false,
        servers: [],
      },
    }),
    service('settings', {
      instanceDefaults: {
        key: '',
        value: null,
      },
    }),
  ],
});

export default store;
