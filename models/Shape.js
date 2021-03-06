var _ = require('lodash'),
    pg = require('../services/db').pg,
    util = require('../lib/utilities'),
    err = util.Err,
    hstore = require('hstore.js'),
    Q = require('q');


var Shape = module.exports = pg.model("shapes", {
    schema: {
        type_id: { type: Number, allowNull: false },
        periods: { type: [Number], allowNull: false },
        start_day:   { type: Number, default: 1 },
        start_month: { type: Number, default: 1 },
        start_year:  { type: Number },
        end_day:     { type: Number, default: 1 },
        end_month:   { type: Number, default: 1 },
        end_year:    { type: Number },
        tags: [Number],
        data: { type: 'hstore' }
    },
    getters: {
        data: function() {
            if (this.data)
                return hstore.parse(this.data, { numeric_check: true });
            else return null;
        }
    }
});
Shape.Relation = pg.model("shape_relations", { idAttribute: 'sequence_id' });
var Changeset = require('./Changeset');
var Directive = require('./Directive');

// Format shape data
var cleanShapeData = Shape.cleanShapeData = function(data) {
    // Create new data object w/ fixed columns
    var newData = {
        type_id:      data.type_id,
        periods:      data.periods,
        start_day:    data.start_day || 1,
        start_month:  data.start_month || 1,
        start_year:   data.start_year,
        end_day:      data.end_day || 1,
        end_month:    data.end_month || 1,
        end_year:     data.end_year,
        tags:         data.tags || [],
        data: null,
    };

    // Create hstore with extra data
    var hstore = _(data).reduce(function(hstore, value, key) {
        if (!_.contains(_.keys(newData), key)) {
            value = pg.engine.escape(value).replace(/'/g, "\"");
            hstore.push(key + ' => ' + value);
        }
        return hstore;
    }, []);
    newData.data = [["'" + hstore.join(", ") + "'"]];

    return newData;
};

// Validates shape relation object
function validateRelation(rel) {
    var keys = ['type', 'id', 'role', 'sequence'];
    var types = ['Node', 'Way', 'Shape'];
    var roles = ['outer', 'inner', 'point', 'center', 'line'];

    rel = _.pick(rel, keys);

    if (!_.isString(rel.id) && !_.isNumber(rel.id)) rel.invalid = true;

    if (_.isString(rel.type))
        rel.type = rel.type.charAt(0).toUpperCase() + rel.type.slice(1);
    if (!_.contains(types, rel.type)) rel.invalid = true;

    if (_.isString(rel.role))
        rel.role = rel.role.toLowerCase();
    if (!_.contains(roles, rel.role)) rel.invalid = true;

    if (rel.sequence) {
        rel.sequence = parseFloat(rel.sequence);
        if (isNaN(rel.sequence)) rel.invalid = true;
    }
    return rel;
}

// Gets a single shape with associated nodes/ways
Shape.get = function(id) {
    var shape = {};
    if (!util.isBigint(id)) return err.reject('ID must be a number','getting shape');

    return Q.all([
        Shape.find(id),
        Shape.getRelations(id)
    ]).spread(function(shapes, relations) {
        return {
            properties: _.isEmpty(shapes) ? null : shapes[0].toJSON(),
            objects: relations.map(function(rel) {
                return {
                    type: rel.relation_type,
                    id: rel.relation_id,
                    role: rel.relation_role,
                    sequence: rel.sequence_id
                };
            })
        };
    }).catch(err.catch('getting shape'));
};

Shape.inChangeset = function(id) {
    return Directive.select('object_id').where({
        changeset_id: id,
        object: 'shape'
    }).then(util.mapPromise(function(directive) {
        return Shape.get(directive.object_id);
    }));
};

Shape.getRelations = function(ids) {
    return Shape.Relation.where({ shape_id: ids }).order('sequence_id');
};

/**
 * Gets data for shape(s)
 * @param {object}      options
 *        {(num|num[])} .shapes    Shape ID(s)
 *   or   {number}      .changeset Changeset ID
 *   or   {number}      .period    Period ID
 *   or   {number}      .year      Year shape is in
 *        {(num|num[])} [.type]    Type ID(s)
 * @returns {array} Array of objects, each with shape data
 */
Shape.getData = function(options) {
     var shapes = options.shapes,
        period = options.period,
        year = parseFloat(options.year),
        changeset = options.changeset,
        type = options.type;

    var where = [];

    if (_.isNumber(shapes)) shapes = [shapes];
    if (shapes) where.push("id IN (:shapes)");
    if (util.isBigint(period)) where.push(":period = ANY (periods)");
      else if (!isNaN(year)) where.push("start_year <= :year AND end_year > :year");
    if (_.isNumber(changeset)) where.push("id IN (SELECT object_id FROM directives WHERE changeset_id = :changeset AND object = 'shape')");
    if (_.isNumber(type)) type = [type];
    if (_.isArray(type)) {
        type = [[type.join()]];
        where.push("type_id IN (:type)");
    }

    where = where.join(' AND ');

    return Shape.where(where, {
        shapes: shapes ? [[shapes.join()]] : '',
        period: period,
        year: year,
        changeset: changeset,
        type: type
    });
};

/**
 * Gets all Nodes for a set of shapes
 * @param {object}      options
 *        {(num|num[])} .shapes    Shape ID(s)
 *   or   {number}      .changeset Changeset ID
 *   or   {number}      .period    Period ID
 *   or   {number}      .year      Year shape is in
 *        {(num|num[])} [.type]    Type ID(s)
 *        {number[]}    [.bbox]    Bounding box (west, south, east, north)
 * @returns {array} Array of objects, each with shape nodes
 */
Shape.getNodes = function(options) {
    var queue = pg.queue(),
        shapes = options.shapes,
        period = options.period,
        year = parseFloat(options.year),
        changeset = options.changeset,
        bbox = options.bbox;

    var type = _.isNumber(options.type) ?
            [options.type] :
            _.isArray(options.type) ? options.type : null,
        getType = (_.isArray(type));
    if (getType) type = [[type.join()]];

    var columns, query, where, order, bboxq;

    // Map column names
    columns = util.columnString({
        shape: "shape_relations.shape_id",
        way: "way_nodes.way_id",
        node: "nodes.id",
        role: "shape_relations.relation_role",
        lat: "nodes.latitude",
        lon: "nodes.longitude",
        seq1: "shape_relations.sequence_id",
        seq2: "way_nodes.sequence_id"
    });

    query = "SELECT " + columns +
            " FROM nodes " +
            "LEFT JOIN way_nodes ON nodes.id = way_nodes.node_id " +
            "LEFT JOIN shape_relations ON (shape_relations.relation_type = 'Way' AND way_nodes.way_id = shape_relations.relation_id) " +
                "OR (shape_relations.relation_type = 'Node' AND nodes.id = shape_relations.relation_id) ";

    bboxq  = ["lat <= :north", "lat >= :south", "lon >= :west", "lon <= :east"].join(" AND ") + ' ';
    order = "ORDER BY shape, seq1, seq2 ";
    where = "WHERE shape_relations.shape_id ";

    if (_.isNumber(shapes) || _.isString(shapes)) shapes = [shapes];

    if (Array.isArray(shapes)) {
        where += "IN (:shapes) ";
    } else if (util.isBigint(changeset)) {
        where += "IN (SELECT object_id FROM directives WHERE changeset_id = :changeset AND object = 'shape') ";
    } else if (util.isBigint(period)) {
        if (getType) where += "IN (SELECT id FROM shapes WHERE :period = ANY (periods) AND type_id IN (:type)) ";
        else         where += "IN (SELECT id FROM shapes WHERE :period = ANY (periods)) ";
    } else if (!isNaN(year)) {
        if (getType) where += "IN (SELECT id FROM shapes WHERE start_year <= :year AND end_year > :year AND type_id IN (:type)) ";
        else         where += "IN (SELECT id FROM shapes WHERE start_year <= :year AND end_year > :year) ";
    } else {
        return err.reject("getNodes needs shapes, changeset, year, or period ID");
    }

    if (isNaN(period) && isNaN(year) && getType) where += "shape_relations.shape_id IN (SELECT id FROM shapes WHERE type_id IN (:type)) ";

    if (Array.isArray(bbox)) where += ' AND ' + bboxq;
    else bbox = [];

    query += where + order;

    return queue.add(query, {
        shapes: shapes ? [[shapes.join()]] : '',
        period: period,
        year: year,
        changeset: changeset,
        type: type,
        west: bbox[0], south: bbox[1],
        east: bbox[2], north: bbox[3]
    }).run();
};

Shape.create = function(data) {
    data = _.clone(data);
    data = cleanShapeData(data);
    return this.returning("id").insert(data);
};

Shape._update = Shape.update;
Shape.update = function(id, data) {
    data = _.clone(data);
    data.data = null;

    // Clean & validate data
    var newData = cleanShapeData(data);
    var validate = Shape.new(newData).validate();
    data = _.pick(newData, _.keys(data));
    validate = _.pick(validate, _.keys(data));
    if (!_.isEmpty(validate)) return err.reject(validate, 'invalid');

    // Prep hstore update
    if (data.data) data.data = [['data || ('+data.data[0][0]+')']]

    return Shape._update(id, data);
};

/**
 * Connects a shape with existing nodes/ways
 * @param {number} shapeId
 * @param {number[]} relations Array of relation objects
 *                  .id, .type, .role, .sequence
 */
Shape.connect = function(shapeId, relations) {
    var i = 0;

    if (relations.length === 0)
        return err.reject('no nodes or ways','connecting shape');
    relations = relations.map(validateRelation);
    var invalid = _.find(relations, { invalid: true });
    if (!_.isEmpty(invalid))
        return err.reject('relations invalid: ' + JSON.stringify(invalid),'connecting shape');

    relations = relations.map(function(rel) {
        return {
            shape_id: shapeId,
            relation_type: rel.type,
            relation_id: rel.id,
            relation_role: rel.role,
            sequence_id: rel.sequence || i++
        };
    });

    return Shape.Relation.insert(relations).thenResolve(shapeId);
};

// Creates shape & relations
Shape.finish = function(data, relations) {
    return Shape.create(data).thenOne(function(shape) {
        return Shape.connect(shape.id, relations);
    });
};

/**
 * Remove relations from shape
 * @param {number} shapeId
 * @param {number[]} seqIds Array of sequence IDs to remove
 */
Shape.addQueryMethod('removeRelations', function(shapeId, seqIds) {
    if (!_.isArray(seqIds)) seqIds = [seqIds];

    var sequence = _.uniqueId('shape_seq_'),
        queue = pg.queue()
        .add(Shape.Relation.where({ shape_id: shapeId, sequence_id: seqIds }).remove());

    // Re-numbers sequence without losing order
    queue.add('CREATE SEQUENCE ' + sequence)
      .add("UPDATE shape_relations SET sequence_id = newseq FROM (" +
        "SELECT sequence_id, (nextval(:seq) - 1) AS newseq FROM " +
            "(SELECT sequence_id FROM shape_relations WHERE shape_id = :shape ORDER BY sequence_id) AS sub" +
        ") AS new_table WHERE " +
        "shape_relations.shape_id = :shape AND " +
        "shape_relations.sequence_id = new_table.sequence_id",
        { shape: shapeId, seq: sequence })
      .add('DROP SEQUENCE ' + sequence);

    return queue;
});

