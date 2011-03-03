_.constructor("Views.Columns.Candidates", View.Template, {
  content: function() { with(this.builder) {
    div({'class': "candidates", style: "display: none;"}, function() {
      div({'class': "columnHeader"}, function() {
        h2("Answers");
      });

      subview('candidatesList', Views.SortedList, {
        rootAttributes: {'class': "candidatesList"},
        buildElement: function(candidate) {
          return Views.Columns.CandidateLi.toView({record: candidate});
        }
      });

      div(function() {
        div({'class': "expandedArea"}).ref("expandedArea");
        subview('rankedCandidatesList', Views.Columns.RankedCandidatesList, {
          rootAttributes: {'class': "candidatesList"}
        });
      }).ref("secondSubColumn");

      div({'class': "loading"}).ref("loading");
    }).ref("body");
  }},

  viewProperties: {

    relativeWidth: 2,

    initialize: function() {
      this.subscriptions = new Monarch.SubscriptionBundle;
      this.candidatesList.buildElement = this.bind(function(candidate) {
        return Views.Columns.CandidateLi.toView({
          record: candidate,
          containingView: this
        });
      });
    },

    state: {
      afterChange: function(state, oldState) {
        this.selectedRecordId(state.recordId);
        if (oldState &&
           (state.parentRecordId  === oldState.parentRecordId) &&
           (state.parentTableName === oldState.parentTableName)) return;
        this.startLoading();
        try {
          var candidateRelation;
          if (state.parentRecordId) {
            candidateRelation = Candidate.where({electionId: state.parentRecordId})
          } else {
            candidateRelation = Candidate.where({id: state.recordId});
          }
          var relationsToFetch = [
            candidateRelation,
            candidateRelation.joinThrough(Election),
            candidateRelation.joinThrough(Ranking),
            candidateRelation.join(User).on(Candidate.creatorId.eq(User.id))
          ];
          Server.fetch(relationsToFetch).onSuccess(function() {
            if (this.containingColumn.isFirst()) this.setCurrentOrganizationId(candidateRelation);
            this.candidatesList.relation(candidateRelation);
            this.stopLoading();
          }, this);
        } catch (badCombinationOfTableNamesAndIds) {
          this.containingColumn.handleInvalidColumnState();
        }
      }
    },

    selectedRecordId: {
      afterChange: function(id) {

      }
    },

    afterShow: function() {
      this.adjustHeight();
    },

    adjustHeight: function() {
      this.loading.position({
        my: 'center center',
        at: 'center center',
        of: this.candidatesList
      });
      this.rankedCandidatesList.adjustHeight();
    },

    startLoading: function() {
      this.candidatesList.children().hide();
      this.rankedCandidatesList.children().hide();
      this.loading.show();
    },

    stopLoading: function() {
      this.loading.hide();
      this.candidatesList.children().show();
      this.rankedCandidatesList.children().show();
      this.adjustHeight();
    },

    setCurrentOrganizationId: function(candidateRelation) {
      var id = candidateRelation.first().election().organizationId();
      Application.currentOrganizationId(id);
    }
  }
});
