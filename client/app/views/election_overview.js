_.constructor("Views.ElectionOverview", View.Template, {
  content: function() { with(this.builder) {
    div({'id': "electionOverview"}, function() {
      div({'class': "grid4"}, function() {
        h1({'class': "clickable"})
          .click('goToOrganization')
          .ref('organizationName');

        div(function() {
          div({'class': "expandArrow", style: "display: none;"})
            .ref('expandArrow')
            .click('expandOrContract');

          div({id: "electionBodyContainer"}, function() {
            textarea({'class': "electionBody", style: "display: none;"})
              .ref('bodyTextarea')
              .bind('keyup paste', 'enableOrDisableSaveButton')
              .keydown(function(view, event) {
                if (event.keyCode === 13) {
                  view.updateElectionBody();
                  event.preventDefault();
                }
              });
            div({'class': "electionBody largeFont"}).ref('bodyDiv');
          });

          div({'class': "clear"});
        });


        div({id: "expandedArea", style: "display: none;"}, function() {
          button("Save")
            .ref('saveButton')
            .click('updateElectionBody');
          button("Delete Question")
            .click('destroyElection');
          div({'class': "loading", style: "display: none;"}).ref('electionSpinner');
          div({'class': "clear"});
        }).ref('expandedArea');

        div({id: "createCandidateForm"}, function() {
          textarea({placeholder: "Type your own suggestion here.", rows: 3})
            .ref('createCandidateTextarea')
            .keypress(function(view, e) {
              if (e.keyCode === 13) {

                if (!view.createCandidateButton.is(":disabled")) {
                  view.createCandidateButton.click();
                }
                return false;
              }
            });

          button("Suggest Answer")
            .click('createCandidate')
            .ref('createCandidateButton');

          div({'class': "loading", style: "display: none"}).ref('createCandidateSpinner');
          div({'class': "clear"});
        }).ref('createCandidateForm');

        subview('votersList', Views.VotesList);
      });


      div({'class': "grid4"}, function() {
        subview('candidatesList', Views.CandidatesList);
      });

      div({'class': "grid4"}, function() {
        subview('rankedCandidatesList', Views.RankedCandidatesList);
      });
    });
  }},

  viewProperties: {
    viewName: 'election',

    initialize: function() {
      this.subscriptions = new Monarch.SubscriptionBundle();
      this.defer(function() {
        this.createCandidateTextarea.elastic();
        this.bodyTextarea.elastic();
      });
    },

    navigate: function(state) {
      this.rankedCandidatesList.hide();
      this.candidatesList.adjustHeight();
      this.rankedCandidatesList.adjustHeight();


      var rankingsUserId = state.rankingsUserId || Application.currentUserId;
      var election = Election.find(state.electionId);
      var rankingsUser = User.find(rankingsUserId);
      if (!election || !rankingsUser) {
        this.retryNavigateAfterFetchingNeededData(state, election, rankingsUser);
        return;
      }

      this.election(election);
      if (!election.candidates().empty()) this.rankedCandidatesList.show();
    },

    retryNavigateAfterFetchingNeededData: function(state, election, rankingsUser) {
      this.startLoading();

      var electionId = state.electionId;
      var rankingsUserId = state.rankingsUserId || Application.currentUserId;

      var relations = [];
      if (!election) {
        relations.push(
          Election.where({id: electionId}).joinTo(Organization), 
          Candidate.where({electionId: electionId})
        );
      }

      if (!rankingsUser) {
        relations.push(User.where({id: rankingsUserId}));
      }

      Server.fetch(relations).onSuccess(function() {
        this.stopLoading();
        this.navigate(state);
      }, this);
    },

    election: {
      afterChange: function(election) {
        this.populateElectionDetails(election);
        this.subscribeToElectionChanges(election);

        this.rankedCandidatesList.empty();
        this.votersList.empty();

        this.candidatesList.election(election);
        this.rankedCandidatesList.startLoading();
        this.votersList.startLoading();

        election.fetchVotesAndRankings()
          .onSuccess(function() {
            this.rankedCandidatesList.stopLoading();
            this.votersList.stopLoading();
            this.rankedCandidatesList.election(election);
            this.votersList.election(election);
          }, this);

        Server.subscribe([election, election.candidates(), election.votes()])
          .onSuccess(function(subscriptions) {
            this.subscriptions.add(subscriptions);
          }, this);
      }
    },

    populateElectionDetails: function(election) {
      this.organizationName.html(election.organization().name());
      this.bodyTextarea.val(election.body());
      this.bodyDiv.html(election.body());
      if (election.belongsToCurrentUser() || election.organization().currentUserIsOwner()) {
        this.expandArrow.show();
      } else {
        this.expandArrow.hide();
      }
      this.contract(true);
      this.votersList.adjustHeight();
    },

    subscribeToElectionChanges: function(election) {
      this.subscriptions.destroy();
      this.subscriptions.add(election.remote.field('body').onUpdate(function(newBody) {
        this.bodyTextarea.val(newBody);
        this.bodyDiv.html(newBody);
      }, this));

      this.subscriptions.add(election.onRemoteDestroy(function() {
        this.goToOrganization();
      }, this));

      this.subscriptions.add(election.candidates().onRemoteInsert(function() {
        if (this.rankedCandidatesList.is(":hidden")) this.rankedCandidatesList.fadeIn();
      }, this));

      this.subscriptions.add(election.candidates().onRemoteRemove(function() {
        if (election.candidates().empty()) this.rankedCandidatesList.fadeOut();
      }, this));

    },

    createCandidate: function() {
      var body = this.createCandidateTextarea.val();
      if (body === "") return;

      this.createCandidateSpinner.show();
      this.createCandidateTextarea.attr('disabled', true)
      this.createCandidateButton.attr('disabled', true);
      this.election().candidates().create({body: body})
        .onSuccess(function() {
          this.createCandidateSpinner.hide();
          this.createCandidateTextarea.val("");
          this.createCandidateTextarea.attr('disabled', false)
          this.createCandidateButton.attr('disabled', false);
        }, this);
    },

    goToOrganization: function() {
      $.bbq.pushState({view: "organization", organizationId: this.election().organizationId() }, 2);
    },

    expandOrContract: function() {
      if (this.expanded) {
        this.contract();
      } else {
        this.expand();
      }
    },

    expand: function() {
      this.expanded = true;
      this.expandArrow.addClass('expanded');
      this.bodyTextarea.show();
      this.bodyTextarea.keyup();
      this.bodyTextarea.focus();
      this.bodyDiv.hide();

      this.votersList.adjustHeight();
      this.expandedArea.slideDown('fast', _.repeat(function() {
        this.votersList.adjustHeight();
      }, this));
    },

    contract: function(dontAnimate) {
      this.expandArrow.removeClass('expanded');
      this.expanded = false;
      this.bodyTextarea.hide();
      this.bodyDiv.show();

      if (dontAnimate) {
        this.expandedArea.hide();
      } else {
        this.expandedArea.slideUp('fast', _.repeat(function() {
          this.votersList.adjustHeight();
        }, this));
      }

      this.votersList.adjustHeight();
    },

    enableOrDisableSaveButton: function() {
      if (this.bodyTextarea.val() === this.election().body()) {
        this.saveButton.attr('disabled', true);
      } else {
        this.saveButton.attr('disabled', false);
      }
    },

    updateElectionBody: function() {
      this.electionSpinner.show();
      this.election().update({body: this.bodyTextarea.val()})
        .onSuccess(function() {
          this.electionSpinner.hide();
          this.expandOrContract();
        }, this);
    },

    destroyElection: function() {
      this.electionSpinner.show();
      this.election().destroy()
        .onSuccess(function() {
          this.electionSpinner.hide();
        }, this);
    },

    startLoading: function() {

    },

    stopLoading: function() {
      
    }
  }
});
