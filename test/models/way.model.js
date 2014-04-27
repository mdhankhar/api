var assert = require('assert');

process.env.ENV_VARIABLE = 'test';
var Way = require('../../models/Way');

var wayId;

describe('Way model', function() {
this.timeout(4000);

describe('#create()', function() {
    it('should create a Way with nodes', function(done) {
        Way.create([[1, 1],[2, 2],[3, 3]], { created_at: new Date(), error: 5 }, function(err, way) {
            assert.ifError(err);
            assert(typeof way.id === 'number');
            wayId = way.id;
            done();
        });
    });
});

describe('#find()', function() {
    it('should find a way with way_nodes', function(done) {
        Way.find(wayId, function(err, n) {
            assert.ifError(err);
            assert.equal(n[0].id, wayId);
            Way.getNodes(wayId, function(err, nodes) {
                assert.ifError(err);
                assert.equal(nodes[0].longitude, 1);
                assert.equal(nodes[2].longitude, 3);
                done();
            });
        });
    });
});
/*
describe('#update()', function() {
    it('should update an existing node', function(done) {
        Node.update(node, {
            longitude: 4.44
        }, function(err, n) {
            assert.ifError(err);
            Node.find(node, function(err, n) {
                assert.equal(n[0].longitude, 4.44);
                done();
            });
        });
    });
});
*/

});
