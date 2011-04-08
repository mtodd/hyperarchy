//= require "../../monarch_spec_helper"

Screw.Unit(function(c) { with(c) {
  describe("Monarch.Http.Server", function() {
    useExampleDomainModel();
    var requests, server;

    before(function() {
      requests = [];
      mock(jQuery, 'ajax', function(request) {
        requests.push(request)
      });

      server = new Monarch.Http.Server();
      server.sandboxUrl = '/sandbox';
    });

    describe("#fetch", function() {
      it("sends a GET request to the sandbox url and puts the resulting records in the repository before firing callbacks on the returned promise", function() {
        var promise = server.fetch(Blog, BlogPost);
        expect(requests.length).to(eq, 1);
        var request = requests[0];

        expect(request.url).to(eq, '/sandbox');
        expect(request.type).to(eq, 'get');
        expect(request.data).to(equal, {
          relations: JSON.stringify([Blog.wireRepresentation(), BlogPost.wireRepresentation()])
        });

        var successCallback = mockFunction("successCallback", function() {
          expect(Blog.find(1)).toNot(beNull);
          expect(BlogPost.find(1)).toNot(beNull);
        });
        var errorCallback = mockFunction("errorCallback");
        promise.onSuccess(successCallback);
        promise.onError(errorCallback);

        request.success({
          'blogs': {
            '1': {
              id: 1,
              name: "Blog 1",
              user_id: 1,
              started_at: 1302069325319
            }
          },
          'blog_posts': {
            '1': {
              id: 1,
              name: "Blog 1 Post 1",
              blog_id: 1
            }
          }
        });
        
        expect(successCallback).to(haveBeenCalled);
        expect(errorCallback).toNot(haveBeenCalled);
      });

      it("fires error callbacks on the returned promise in the event of an error", function() {
        var promise = server.fetch(Blog, BlogPost);
        var successCallback = mockFunction("successCallback");
        var errorCallback = mockFunction("errorCallback");
        promise.onSuccess(successCallback);
        promise.onError(errorCallback);

        requests[0].error("jqXhr", "error", "errorThrown");

        expect(errorCallback).to(haveBeenCalled, withArgs("jqXhr", "error", "errorThrown"));
        expect(successCallback).toNot(haveBeenCalled);
      });
    });

    describe("#create", function() {
      var record, insertCallback, createCallback, successCallback, invalidCallback, errorCallback;

      before(function() {
        record = User.build({ fullName: "Jesus Chang", age: 22, signedUpAt: 1302070303036 });

        var expectUserInRepository = function() {
          expect(User.find(22)).to(eq, record);
        }

        insertCallback = mockFunction('insertCallback', expectUserInRepository);
        createCallback = mockFunction('createCallback', expectUserInRepository);
        successCallback = mockFunction('successCallback', expectUserInRepository);
        invalidCallback = mockFunction('invalidCallback', function() {
          expect(User.find(22)).to(beNull);
        });
        errorCallback = mockFunction('errorCallback');

        User.onInsert(insertCallback);
        record.onCreate(createCallback);
      });
      
      it("sends a POST request to the sandbox url corresponding to the given record's table with its field values", function() {
        server.create(record);
        expect(requests.length).to(eq, 1);
        var request = requests[0];

        expect(request.type).to(eq, 'post');
        expect(request.url).to(eq, '/sandbox/users');
        expect(request.data).to(equal, {
          field_values: record.wireRepresentation()
        });
      });

      context("when the creation is successful", function() {
        it("updates the record with the field values returned by the server and inserts it into the repository", function() {
          server.create(record);
          requests[0].success({
            id: 22,
            full_name: "Jesus H. Chang",
            age: 23,
            signed_up_at: 1302070303036
          });

          expect(User.find(22)).to(eq, record);
          expect(record.fullName()).to(eq, "Jesus H. Chang");
          expect(record.age()).to(eq, 23);
          expect(record.signedUpAt().getTime()).to(eq, 1302070303036);
        });

        it("fires insert/create callbacks on the table/record, and success callbacks registered on the returned promise", function() {
          var promise = server.create(record);
          promise.onSuccess(successCallback);

          requests[0].success({ id: 22 });

          expect(insertCallback).to(haveBeenCalled);
          expect(insertCallback.mostRecentArgs[0]).to(eq, record); // other args relate to sort index and are tested elsewhere
          expect(createCallback).to(haveBeenCalled);
          expect(successCallback).to(haveBeenCalled, withArgs(record));
        });

        it("pauses all other events on the repository until the create request is completed and its callbacks are fired", function() {
          var otherCallback = mockFunction('otherCallback', function() {
            expect(insertCallback).to(haveBeenCalled);
            expect(createCallback).to(haveBeenCalled);
            expect(successCallback).to(haveBeenCalled);
          });
          Blog.onInsert(otherCallback);

          var promise = server.create(record);
          promise.onSuccess(successCallback);

          expect(Repository.mutationsPaused).to(beTrue);
          Repository.mutate([['create', 'blogs', { id: 1}]]);
          expect(otherCallback).toNot(haveBeenCalled);

          requests[0].success({ id: 22 });

          expect(Repository.mutationsPaused).to(beFalse);

          expect(otherCallback).to(haveBeenCalled);
        });
      });

      context("when the creation results in a validation error", function() {
        it("assigns validation errors to the record, fires onInvalid callbacks, and resumes mutations", function() {
          var promise = server.create(record);
          promise.onInvalid(invalidCallback);

          var validationErrors = {
            full_name: ["This name is very unlikely"],
            age: ["Much too young", "Must be a baby-boomer"]
          };

          requests[0].error({
            status: 422,
            responseText: JSON.stringify(validationErrors)
          });

          expect(invalidCallback).to(haveBeenCalled, withArgs(record));
          expect(record.isRemotelyCreated).to(beFalse);
          expect(record.valid()).to(beFalse);

          expect(record.field('fullName').validationErrors).to(equal, ["This name is very unlikely"]);
          expect(record.field('age').validationErrors).to(equal, ["Much too young", "Must be a baby-boomer"]);

          expect(Repository.mutationsPaused).to(beFalse);
        });
      });

      context("when the creation results in an error not pertaining to validation", function() {
        it("fires onError callbacks with the error arguments from jQuery and resumes mutations", function() {
          var promise = server.create(record);
          promise.onError(errorCallback);

          requests[0].error({ status: 403 }, 'error', 'errorThrown');

          expect(errorCallback).to(haveBeenCalled, withArgs({ status: 403 }, 'error', 'errorThrown'));
          expect(Repository.mutationsPaused).to(beFalse);
        });
      });
    });

    describe("#update", function() {
      var record, tableUpdateCallback, recordUpdateCallback, successCallback, invalidCallback, errorCallback;

      before(function() {
        record = User.createFromRemote({ id: 1, fullName: "Jesus Chang", age: 22, signedUpAt: 1302070303036 });

        var expectUserUpdated = function() {
          expect(record.fullName()).toNot(eq, "Jesus Chang");
          expect(record.age()).toNot(eq, 22);
        }

        tableUpdateCallback = mockFunction('tableUpdateCallback', expectUserUpdated);
        recordUpdateCallback = mockFunction('createCallback', expectUserUpdated);
        successCallback = mockFunction('successCallback', expectUserUpdated);
        invalidCallback = mockFunction('invalidCallback');
        errorCallback = mockFunction('errorCallback');

        User.onUpdate(tableUpdateCallback);
        record.onUpdate(recordUpdateCallback);

        record.localUpdate({
          fullName: "Jesus H. Chang",
          age: 33
        });

      });

      it("sends a PUT request to the sandbox url corresponding to the given record's table with its id and dirty field values", function() {
        record.localUpdate({
          fullName: "Jesus H. Chang",
          age: 33
        });

        server.update(record);
        expect(requests.length).to(eq, 1);
        var request = requests[0];

        expect(request.type).to(eq, 'put');
        expect(request.url).to(eq, '/sandbox/users/1');
        expect(request.data).to(equal, {
          field_values: record.dirtyWireRepresentation()
        });
      });

      context("when the update is successful", function() {
        it("updates the record with the field values returned by the server and clears any validation errors on the updated fields", function() {
          record.assignValidationErrors({
            fullName: ["Must have a middle name"]
          });
          expect(record.valid()).to(beFalse);

          server.update(record);
          requests[0].success({
            full_name: "Jesus Hubert Chang",
            age: 34
          });

          expect(record.valid()).to(beTrue);

          expect(record.fullName()).to(eq, "Jesus Hubert Chang");
          expect(record.age()).to(eq, 34);
        });

        it("fires update callbacks on the table/record, and success callbacks registered on the returned promise", function() {
          var promise = server.update(record);
          promise.onSuccess(successCallback);

          requests[0].success({
            full_name: "Jesus Hubert Chang",
            age: 34
          });

          var expectedChangeset = {
            fullName: {
              column: User.fullName,
              oldValue: "Jesus Chang",
              newValue: "Jesus Hubert Chang"
            },
            age: {
              column: User.age,
              oldValue: 22,
              newValue: 34
            }
          };

          expect(tableUpdateCallback).to(haveBeenCalled);
          expect(tableUpdateCallback.mostRecentArgs[0]).to(eq, record);
          expect(tableUpdateCallback.mostRecentArgs[1]).to(equal, expectedChangeset); // other args relate to sort index and are tested elsewhere
          expect(recordUpdateCallback).to(haveBeenCalled, withArgs(expectedChangeset));
          expect(successCallback).to(haveBeenCalled, withArgs(record, expectedChangeset));
        });

        it("pauses all other events on the repository until the create request is completed and its callbacks are fired", function() {
          var otherCallback = mockFunction('otherCallback', function() {
            expect(recordUpdateCallback).to(haveBeenCalled);
            expect(tableUpdateCallback).to(haveBeenCalled);
            expect(successCallback).to(haveBeenCalled);
          });
          Blog.onInsert(otherCallback);

          var promise = server.update(record);
          promise.onSuccess(successCallback);

          expect(Repository.mutationsPaused).to(beTrue);
          Repository.mutate([['create', 'blogs', { id: 1}]]);
          expect(otherCallback).toNot(haveBeenCalled);

          requests[0].success({ fullName: "Jesus Hubert Chang", age: 33 });

          expect(Repository.mutationsPaused).to(beFalse);

          expect(otherCallback).to(haveBeenCalled);
        });
      });

      context("when the update results in a validation error", function() {
        it("does not perform the update, assigns validation errors to the record, fires onInvalid callbacks, and resumes mutations", function() {
          var promise = server.update(record);
          promise.onInvalid(invalidCallback);

          var validationErrors = {
            full_name: ["This name is very unlikely"],
            age: ["Much too young", "Must be a baby-boomer"]
          };

          requests[0].error({
            status: 422,
            responseText: JSON.stringify(validationErrors)
          });

          expect(invalidCallback).to(haveBeenCalled, withArgs(record));
          expect(record.valid()).to(beFalse);

          expect(record.fullName()).to(eq, "Jesus H. Chang");
          expect(record.remote.fullName()).to(eq, "Jesus Chang");
          expect(record.age()).to(eq, 33);
          expect(record.remote.age()).to(eq, 22);
          expect(record.field('fullName').validationErrors).to(equal, ["This name is very unlikely"]);
          expect(record.field('age').validationErrors).to(equal, ["Much too young", "Must be a baby-boomer"]);

          expect(Repository.mutationsPaused).to(beFalse);
        });
      });
    });
  });
}});
