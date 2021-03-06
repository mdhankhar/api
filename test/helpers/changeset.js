module.exports = {
  add: {
    node1: {
      action: 'add',
      object: 'node',
      object_id: 'n-1',
      geometry: [5.2, 7.8]
    },
    node2: {
      action: 'add',
      object: 'node',
      object_id: 'n-2',
      geometry: [6.2, 9.8],
      data: { source_id: 1 }
    },
    node3: {
      action: 'add',
      object: 'node',
      object_id: 'n-3',
      geometry: [11, 12],
      way_nodes: ['0-1']
    },
    badNode: {
      action: 'add',
      object: 'node',
      object_id: 'n-1',
      geometry: [190, -90]
    },
    way1: {
      action: 'add',
      object: 'way',
      object_id: 'w-1',
      way_nodes: ['n-1','n-2']
    },
    way2: {},
    shape1: {
      action: 'add',
      object: 'shape',
      object_id: 's-1',
      data: { type_id: 1, periods: [1], start_year: 1000, end_year: 1200, name: 'test', one: 1 },
      shape_relations: ['0-Way-outer-w-1','1-Way-inner-1']
    },
    level: {
      action: 'add',
      object: 'level',
      object_id: 'l-1',
      data: { name: 'country', level: 2 }
    },
    type: {
      action: 'add',
      object: 'type',
      object_id: 't-1',
      data: { name: 'city', level_id: '1' }
    },
    type2: {
      action: 'add',
      object: 'type',
      object_id: 't-2',
      data: { name: 'state', level_id: 'l-1' }
    },
    source: {
      action: 'add',
      object: 'source',
      object_id: 'sc-1',
      data: { name: 'Node.js', source: 'test!!!!' }
    },
    period: {
      action: 'add',
      object: 'period',
      object_id: 'p-1',
      data: { name: '1990-2000', start_year: 1990, end_year: 2000 }
    },
  },
  edit: {
    node1: {
      action: 'edit',
      object: 'node',
      object_id: '1',
      geometry: [15, 22]
    },
    shape1: {
      action: 'edit',
      object: 'shape',
      object_id: '1',
      data: { name: 'shape1' },
      shape_relations: ['3-Way-outer-2']
    }
  },
  delete: {
    node1: {
      action: 'delete',
      object: 'node',
      object_id: '1'
    }
  }
};
