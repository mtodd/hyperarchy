//= require spec/spec_helper

describe("Views.Pages.Election.CandidateDetails", function() {
  var candidateDetails, candidate, creator, election;

  beforeEach(function() {
    attachLayout();
    candidateDetails = Application.electionPage.candidateDetails;
    creator = User.createFromRemote({id: 999, emailHash: 'blas', firstName: "Mr.", lastName: "Creator"});
    Application.currentUser(creator);
    election = Election.createFromRemote({id: 1, creatorId: 999, createdAt: 12});
    candidate = creator.candidates().createFromRemote({id: 1, electionId: 1, body: "Mustard.", details: "Pardon me. Do you have any Gray Poupon?", createdAt: 1308352736162});

    $('#jasmine_content').html(Application.electionPage);
    Application.electionPage.showCandidateDetails();

    candidateDetails.candidate(candidate);
  });

  describe("when the candidate is assigned", function() {
    it("populates the body, details, and avatar", function() {
      expect(candidateDetails.body.text()).toEqual(candidate.body());
      expect(candidateDetails.details.text()).toEqual(candidate.details());
      candidate.remotelyUpdated({body: "Catsup", details: "37 flavors"});
      expect(candidateDetails.body.text()).toEqual(candidate.body());
      expect(candidateDetails.details.text()).toEqual(candidate.details());
      expect(candidateDetails.avatar.user()).toBe(candidate.creator());
      expect(candidateDetails.creatorName.text()).toBe(creator.fullName());
      expect(candidateDetails.createdAt.text()).toBe(candidate.formattedCreatedAt());
    });

    it("removes subscriptions to the previous candidate", function() {
      var candidate2 = Candidate.createFromRemote({id: 57, body: "soup.", electionId: election.id(), createdAt: 1111, creatorId: creator.id()});
      var subscriptionsBefore = candidate.onDestroyNode.size();

      candidateDetails.candidate(candidate2);

      expect(candidate.onDestroyNode.size()).toBe(subscriptionsBefore - 1);

      spyOn(History, 'pushState');
      candidate.remotelyDestroyed();
      expect(History.pushState).not.toHaveBeenCalled();
    });

    it("hides the form if it is showing, even if the candidate does not change", function() {
      candidateDetails.candidate(candidate);

      candidateDetails.editLink.click();

      expect(candidateDetails.form).toBeVisible();
      expect(candidateDetails.nonEditableContent).toBeHidden();

      candidateDetails.candidate(candidate);

      expect(candidateDetails.form).toBeHidden();
      expect(candidateDetails.nonEditableContent).toBeVisible();
    });

    it("handles null candidates", function() {
      candidateDetails.candidate(null);
    });
  });

  describe("showing and hiding of the edit and destroy buttons", function() {
    var currentUserCanEdit;
    beforeEach(function() {
      spyOn(Candidate.prototype, 'editableByCurrentUser').andCallFake(function() {
        return currentUserCanEdit;
      });
      candidateDetails.editLink.hide();
      candidateDetails.destroyLink.hide();
      expect(candidateDetails.editLink).toBeHidden();
    });

    describe("on candidate assignment", function() {
      it("shows the edit link only if the current user can edit", function() {
        var otherCandidate = Candidate.createFromRemote({id: 100, creatorId: creator.id(), createdAt: 234234});

        expect(candidateDetails.editLink).toBeHidden();
        expect(candidateDetails.destroyLink).toBeHidden();
        currentUserCanEdit = true;
        candidateDetails.candidate(otherCandidate);
        expect(candidateDetails.editLink).toBeVisible();
        expect(candidateDetails.destroyLink).toBeVisible();

        currentUserCanEdit = false;
        candidateDetails.candidate(candidate);
        expect(candidateDetails.editLink).toBeHidden();
        expect(candidateDetails.destroyLink).toBeHidden();
      });
    });

    describe("on user switch", function() {
      it("shows the edit button only when the current user is the creator of the candidate, an owner of the organization, or an admin", function() {
        var otherUser = User.createFromRemote({id: 123});

        expect(candidateDetails.editLink).toBeHidden();
        expect(candidateDetails.destroyLink).toBeHidden();
        currentUserCanEdit = true;
        Application.currentUser(otherUser);
        expect(candidateDetails.editLink).toBeVisible();
        expect(candidateDetails.destroyLink).toBeVisible();

        currentUserCanEdit = false;
        Application.currentUser(creator);
        expect(candidateDetails.editLink).toBeHidden();
        expect(candidateDetails.destroyLink).toBeHidden();
      });
    });
  });

  describe("showing and hiding the new form", function() {
    it("hides comments and empties out and shows the form fields & create button when #showNewForm is called", function() {
      candidateDetails.formBody.val("woweee!");
      candidateDetails.formDetails.val("cocooo!");
      candidateDetails.hideForm();

      var now = new Date();
      spyOn(window, 'Date').andReturn(now);

      expect(candidateDetails.createLink).toBeHidden();
      candidateDetails.showNewForm();
      expect(candidateDetails.form).toBeVisible();
      expect(candidateDetails.formBody.val()).toBe('');
      expect(candidateDetails.formDetails.val()).toBe('');
      expect(candidateDetails.createLink).toBeVisible();
      expect(candidateDetails.cancelEditLink).toBeHidden();
      expect(candidateDetails.updateLink).toBeHidden();
      expect(candidateDetails.comments).toBeHidden();

      expect(candidateDetails.avatar.user()).toBe(Application.currentUser());
      expect(candidateDetails.creatorName.text()).toBe(Application.currentUser().fullName());
      expect(candidateDetails.createdAt.text()).toBe($.PHPDate("M j, Y @ g:ia", now));

      candidateDetails.candidate(candidate);

      expect(candidateDetails.form).toBeHidden();
      expect(candidateDetails.createLink).toBeHidden();
      expect(candidateDetails.cancelEditLink).toBeHidden();
      expect(candidateDetails.updateLink).toBeHidden();
      expect(candidateDetails.comments).toBeVisible();
    });
  });

  describe("when the create button is clicked", function() {
    var fieldValues;

    beforeEach(function() {
      useFakeServer();
      Application.electionPage.election(election);
      candidateDetails.showNewForm();
      fieldValues = {
        body: "Relish",
        details: "That green stuff..."
      }

      candidateDetails.formBody.val(fieldValues.body);
      candidateDetails.formDetails.val(fieldValues.details);
    });

    describe("when the body field is filled in", function() {
      it("creates a new candidates with the given body and details on the server and hides the form", function() {
        candidateDetails.createLink.click();

        expect(Server.creates.length).toBe(1);

        expect(Server.lastCreate.record.dirtyWireRepresentation()).toEqual(_.extend(fieldValues, {election_id: election.id()}));
        Server.lastCreate.simulateSuccess();

        expect(Path.routes.current).toBe(election.url());
      });

      it("wires the form submit event to save", function() {
        candidateDetails.form.submit();
        expect(Server.updates.length).toBe(1);
      });
    });

    describe("when the body field is empty", function() {
      it("does nothing", function() {
        spyOn(History, 'pushState');
        candidateDetails.formBody.val('                  ');
        candidateDetails.createLink.click();
        expect(Server.creates.length).toBe(0);
        expect(History.pushState).not.toHaveBeenCalled();
      });
    });
  });

  describe("showing and hiding of the edit form", function() {
    it("shows and populates the form fields and sets focus when edit is clicked and hides them when cancel is clicked", function() {
      expect(candidateDetails.form).toBeHidden();
      expect(candidateDetails.nonEditableContent).toBeVisible();

      candidateDetails.editLink.click();

      expect(candidateDetails.form).toBeVisible();
      expect(candidateDetails.updateLink).toBeVisible();
      expect(candidateDetails.cancelEditLink).toBeVisible();
      expect(candidateDetails.nonEditableContent).toBeHidden();

      expect(candidateDetails.formBody.val()).toBe(candidate.body());
      expect(candidateDetails.formBody[0]).toBe(document.activeElement);
      expect(candidateDetails.formDetails.val()).toBe(candidate.details());

      candidateDetails.cancelEditLink.click();

      expect(candidateDetails.form).toBeHidden();
      expect(candidateDetails.updateLink).toBeHidden();
      expect(candidateDetails.cancelEditLink).toBeHidden();
      expect(candidateDetails.nonEditableContent).toBeVisible();
    });
  });

  describe("when the update button is clicked", function() {
    var fieldValues;

    beforeEach(function() {
      useFakeServer();
      candidateDetails.editLink.click();
      fieldValues = {
        body: "Relish",
        details: "That green stuff..."
      }

      candidateDetails.formBody.val(fieldValues.body);
      candidateDetails.formDetails.val(fieldValues.details);
    });

    it("updates the record's body and details on the server and hides the form", function() {
      candidateDetails.updateLink.click();
  
      expect(Server.updates.length).toBe(1);

      expect(Server.lastUpdate.dirtyFieldValues).toEqual(fieldValues);
      Server.lastUpdate.simulateSuccess();

      expect(candidateDetails.form).toBeHidden();
      expect(candidateDetails.nonEditableContent).toBeVisible();
      
      expect(candidateDetails.body.text()).toBe(fieldValues.body);
      expect(candidateDetails.details.text()).toBe(fieldValues.details);
    });

    it("wires the form submit event to save", function() {
      candidateDetails.form.submit();
      expect(Server.updates.length).toBe(1);
    });

    it("does not allow a blank body", function() {
      spyOn(History, 'pushState');
      candidateDetails.formBody.val('  ');
      candidateDetails.updateLink.click();
      expect(Server.updates.length).toBe(0);
      expect(History.pushState).not.toHaveBeenCalled();
    });
  });

  describe("when the destroy button is clicked", function() {
    beforeEach(function() {
      useFakeServer();
    });

    describe("if the user accepts the confirmation", function() {
      it("deletes the candidate", function() {
        spyOn(window, 'confirm').andReturn(true);

        candidateDetails.destroyLink.click();

        expect(Server.destroys.length).toBe(1);
        expect(Server.lastDestroy.record).toBe(candidate);
      });
    });

    describe("if the user rejects the confirmation", function() {
      it("does not delete the candidate", function() {
        spyOn(window, 'confirm').andReturn(false);

        candidateDetails.destroyLink.click();

        expect(Server.destroys.length).toBe(0);
      });
    });
  });

  describe("when the candidate is destroyed", function() {
    it("navigates to the election url", function() {
      candidate.remotelyDestroyed();
      expect(Path.routes.current).toBe(election.url());
    });
  });
});