process.env.TEST = 'true';

var expect = require('chai').expect;
var assert = require('assert');

var wiki = require('../lib/wiki');
var cs = require('./helpers/changeset');

var Node = require('../models/Node');
var Way = require('../models/Way');

var newId;

describe('Wiki', function() {

describe('#parse()', function() {
    it('should parse a directive', function(done) {
        wiki.parse([ cs.add.node1 ]).then(function(drs) {
            var d = drs[0];
            expect(d.action).to.equal('add');
            expect(d.object).to.equal('node');
        }).then(done, done);
    });

    it('should correctly replace IDs', function(done) {
        wiki.parse([ cs.add.node1, cs.add.way1 ]).then(function(drs) {
            var node = drs[0], way = drs[1];
            expect(node.object_id).to.not.equal('n-1');
            expect(way.way_nodes.split(',')[0]).to.equal(node.object_id);
        }).then(done, done);
    });

    describe('#node', function() {
        it('should edit a node', function(done) {
            var dir = cs.edit.node1;
            new wiki.Diff().run(dir).then(function(d) {
                assert(d.success, d.response);
                return Node.find(d.object_id);
            }).then(function(nodes) {
                expect(nodes).to.not.be.empty;
                expect(nodes[0].longitude).to.equal(dir.geometry[0]+'');
            }).then(done, done);
        });
        it('should add a node', function(done) {
            var dir = cs.add.node1;
            new wiki.Diff().run(dir).then(function(d) {
                assert(d.success, d.response);
                expect(d.object_id).to.not.equal(dir.object_id);
                newId = d.object_id;
                return Node.find(d.object_id);
            }).then(function(nodes) {
                expect(nodes[0].longitude).to.equal(dir.geometry[0]+'');
            }).then(done, done);
        });
        it('shouldn\'t add a bad node', function(done) {
            var dir = cs.add.badNode;
            new wiki.Diff().run(dir).then(function(d) {
                expect(d.invalid).to.be.true;
            }).then(done, done);
        });
        it('should delete a node', function(done) {
            var dir = { action: 'delete', object:'node', object_id:newId };
            new wiki.Diff().run(dir).then(function(d) {
                assert(d.success, d.response);
                return Node.find(d.object_id);
            }).then(function(nodes) {
                expect(nodes).to.be.empty;
            }).then(done, done);
        });
    });

    describe('#way', function() {
        it('should edit a way', function(done) {
            new wiki.Diff().run({
                action: 'edit', object: 'way',
                object_id: '1',
                way_nodes: ['0-1','1-2']
            }).then(function(d) {
                assert(d.success, d.response);
                return Way.getNodes(d.object_id);
            }).then(function(nodes) {
                expect(nodes[1].id).to.equal('2');
            }).then(done, done);
        });
        it('should add a way', function(done) {
            wiki.parse([
                cs.add.node1, cs.add.node2,
                cs.add.way1
            ]).then(function(drs) {
                assert(drs[drs.length-1].success, drs[drs.length-1].response);
                return Way.getNodes(drs[2].object_id);
            }).then(function(nodes) {
                expect(nodes[0].longitude).to.equal(cs.add.node1.geometry[0]+'');
                expect(nodes[1].longitude).to.equal(cs.add.node2.geometry[0]+'');
            }).then(done, done);
        });
        it('should delete a way', function(done) {
            new wiki.Diff().run({
                action: 'delete', object: 'way',
                object_id: '1',
                way_nodes: ['0']
            }).then(function(d) {
                assert(d.success, d.response);
                return Way.getNodes(d.object_id);
            }).then(function(nodes) {
                expect(nodes[0].id).to.not.equal('1');
            })
            .then(done, done);
        });
    });

    describe('#shape', function() {
    // TODO: it('should edit a shape', function(done) {});
    // TODO: it('should add a shape', function(done) {});
    // TODO: it('should delete a shape', function(done) {});
    });

    describe('#level', function() {
    // TODO: it('should edit a level', function(done) {});
    // TODO: it('should add a level', function(done) {});
    // TODO: it('should delete a level', function(done) {});
    });

    describe('#type', function() {
    // TODO: it('should edit a type', function(done) {});
    // TODO: it('should add a type', function(done) {});
    // TODO: it('should delete a type', function(done) {});
    });

    describe('#source', function() {
    // TODO: it('should edit a source', function(done) {});
    // TODO: it('should add a source', function(done) {});
    // TODO: it('should delete a source', function(done) {});
    });
});

describe('#commit()', function() {
    // TODO: it('should update commit message', function(done) {});

    // TODO: it('should sort directives', function(done) {});

    // TODO: it('should record finished directives', function(done) {});
});

});
