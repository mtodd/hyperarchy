_.constructor("OldMonarch.Http.FakeServer.FakeCreation", {
  type: 'create',

  initialize: function(fakeServer, record) {
    this.fakeServer = fakeServer;
    this.record = record;
    this.promise = new OldMonarch.Promise();
  },

  simulateSuccess: function(optionalFieldsFromServer) {
    if (!optionalFieldsFromServer) optionalFieldsFromServer = {};
    this.fakeServer.removeRequest(this);
    var lastRecord = this.record.constructor.last();
    var nextId = lastRecord ? lastRecord.id() + 1 : 1;
    var fields = _.extend({id: nextId }, this.record.dirtyWireRepresentation(), optionalFieldsFromServer);
    this.record.created(fields);
    this.promise.triggerSuccess(this.record);
  }
});