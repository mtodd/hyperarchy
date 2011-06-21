_.constructor('Views.Pages.Election', Monarch.View.Template, {
  content: function() { with(this.builder) {
    div({id: "election"}, function() {
      div({id: "columns"}, function() {
        for (var i = 1; i <= 4; i++) {
          div({'class': "column"}, function() {
            div(function() {
              div({style: "height: 0"}, function() { raw("&nbsp;") }); // hack to allow textareas first
              template['column' + i]();
            });
          });
        }
      });
    });
  }},

  column1: function() { with(this.builder) {
    div({id: "election-details"}, function() {
      div(function() {
        h2({'class': 'body'}).ref('body');
        div({'class': 'details'}).ref('details');
      }).ref('nonEditableContent');

      form(function() {
        textarea({name: "body", 'class': "body"}).ref("formBody");
        label({'for': "body", 'class': "chars-remaining"}, "67 characters remaining");
        label({'for': "details"}, "Further Details");
        textarea({name: 'details', 'class': "details"}).ref("formDetails");
      }).submit('save')
        .ref('form');

      a({'class': 'save button'}, "Save").ref('saveLink').click('save');
      a({'class': 'cancel button'}, "Cancel").ref('cancelEditLink').click('hideForm');
      a({'class': "edit button"}, "Edit").ref('editLink').click('showForm');

      div({'class': 'creator'}, function() {
        subview('avatar', Views.Components.Avatar, {imageSize: 34});
        div({'class': 'name'}).ref('creatorName');
        div({'class': 'date'}).ref('createdAt');
      });

    })
  }},

  column2: function() { with(this.builder) {
    subview('currentConsensus', Views.Pages.Election.CurrentConsensus);
  }},

  column3: function() { with(this.builder) {
    h2("Your Ranking").ref('rankedCandidatesHeader');
    h2("Answer Details").ref('candidateDetailsHeader');

    div({id: "rankings-and-details"}, function() {
      subview('candidateDetails', Views.Pages.Election.CandidateDetails);
      subview('rankedCandidates', Views.Pages.Election.RankedCandidates);
    });
  }},

  column4: function() { with(this.builder) {
    subview('votes', Views.Pages.Election.Votes);
  }},

  viewProperties: {
    params: {
      change: function(params, oldParams) {
        this.populateContentBeforeFetch(params);
        return this.fetchData(params, oldParams)
          .success(this.hitch('populateContentAfterFetch', params));
      }
    },

    populateContentBeforeFetch: function(params) {
      var election = Election.find(params.electionId);
      if (election) this.election(election);

      var voterId;
      if (!params.candidateId) {
        this.candidateDetails.removeClass('active');
        this.currentConsensus.selectedCandidate(null);
        voterId = params.voterId || Application.currentUserId();
        this.rankedCandidates.sortingEnabled(!voterId || voterId === Application.currentUserId());
        this.populateRankedCandidatesHeader(voterId);
      }

      this.votes.selectedVoterId(voterId);
    },

    fetchData: function(params, oldParams) {
      var relationsToFetch = [];

      if (!oldParams || params.electionId !== oldParams.electionId) {
        if (!Election.find(params.electionId)) relationsToFetch.push(Election.where({id: params.electionId})); // election
        relationsToFetch.push(Candidate.where({electionId: params.electionId}).join(User).on(Candidate.creatorId.eq(User.id))); // candidates
        relationsToFetch.push(Vote.where({electionId: params.electionId}).joinTo(User)); // votes
        relationsToFetch.push(Application.currentUser().rankings().where({electionId: params.electionId})); // current user's rankings
      }

      if (params.voterId) {
        relationsToFetch.push(Ranking.where({electionId: params.electionId, userId: params.voterId})); // additional rankings
      }

      return Server.fetch(relationsToFetch);
    },

    populateContentAfterFetch: function(params) {
      var election = Election.find(params.electionId);

      if (!election) {
        History.pushState(null, null, Application.currentUser().defaultOrganization().url());
        return;
      }

      this.election(election);
      this.currentConsensus.candidates(election.candidates());
      this.votes.votes(election.votes());

      if (params.candidateId) {
        var candidate = Candidate.find(params.candidateId)
        this.currentConsensus.selectedCandidate(candidate);
        this.showCandidateDetails();
        this.candidateDetails.candidate(candidate);
      } else {
        var rankings = Ranking.where({electionId: params.electionId, userId: params.voterId || Application.currentUserId()});
        this.showRankedCandidates();
        this.populateRankedCandidatesHeader(params.voterId);
        this.rankedCandidates.rankings(rankings);
      }
    },

    populateRankedCandidatesHeader: function(voterId) {
      if (!voterId || voterId === Application.currentUserId()) {
        this.rankedCandidatesHeader.text('Your Ranking');
        return;
      }

      var voter = User.find(voterId);
      if (voter) this.rankedCandidatesHeader.text(voter.fullName() + "'s Ranking");
    },

    election: {
      change: function(election) {
        Application.currentOrganizationId(election.organizationId());
        this.body.bindText(election, 'body');
        this.details.bindText(election, 'details');

        if (election.details()) {
          this.details.show()
        } else {
          this.details.hide()
        }

        this.avatar.user(election.creator());
        this.creatorName.bindText(election.creator(), 'fullName');
        this.createdAt.text(election.formattedCreatedAt());
        this.hideForm();
      }
    },

    showRankedCandidates: function() {
      this.candidateDetailsHeader.hide();
      this.rankedCandidatesHeader.show();
      this.candidateDetails.removeClass('active');
    },

    showCandidateDetails: function() {
      this.rankedCandidatesHeader.hide();
      this.candidateDetailsHeader.show();
      this.candidateDetails.addClass('active');
    },

    showForm: function() {
      this.nonEditableContent.hide();
      this.editLink.hide();
      this.form.show();
      this.formBody.val(this.election().body()).elastic();
      this.formDetails.val(this.election().details()).elastic();
      this.saveLink.show();
      this.cancelEditLink.show();
    },

    hideForm: function() {
      this.nonEditableContent.show();
      this.editLink.show();
      this.form.hide();
      this.saveLink.hide();
      this.cancelEditLink.hide();
    }
  }
});
