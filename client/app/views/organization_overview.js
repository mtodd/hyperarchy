_.constructor("Views.OrganizationOverview", View.Template, {
  content: function() { with(this.builder) {
    div({id: "organizationOverview"}, function() {

      div({id: "organizationOverviewHeader"}, function() {
        h2('Questions Under Discussion');
      });

      subview('electionsList', Views.SortedList, {
        useQueue: true,
        buildElement: function(election) {
          return Views.ElectionLi.toView({election: election});
        },
        onRemoteInsert: function(election, li) {
          li.effect('highlight');
        },
        onRemoteUpdate: function(li, election, changeset) {
          if (changeset.updatedAt) li.contentDiv.effect('highlight', {color:"#ffffcc"}, 2000);
          if (changeset.body) li.body.html(changeset.body.newValue);
          if (changeset.voteCount) li.updateVoteCount(changeset.voteCount.newValue);
        }
      });

      div({'class': "clear"});

      div(function() {
        div({id: "rightContent"}, function() {
          a("< Previous");
          span("1-10 of 89");
          a("Next >");
        });
        div({id: "leftContent"}, function() {});
      }).ref("subNavigationContent");

      div({'class': "bigLoading", 'style': "display: none;"}).ref('loading');
    });
  }},

  viewProperties: {
    defaultView: true,
    viewName: 'organization',

    initialize: function() {
      this.subscriptions = new Monarch.SubscriptionBundle();
    },

    navigate: function(state) {
      if (!state.organizationId) {
        $.bbq.pushState({view: 'organization', organizationId: Application.currentUser().lastVisitedOrganization().id()});
        return;
      }
      var organizationId = parseInt(state.organizationId);
      Application.currentOrganizationId(organizationId);
      this.organizationId(organizationId);

      Application.layout.activateNavigationTab("questionsLink");
//      Application.layout.showSubNavigationContent("organizations");
      Application.layout.showSubNavigationContent("");
    },

    organizationId: {
      afterChange: function(organizationId) {
        var membership = this.organization().membershipForCurrentUser();
        if (membership) membership.update({lastVisited: new Date()});

        this.subscriptions.destroy();
        this.displayElections();
      }
    },

    organization: function() {
      return Organization.find(this.organizationId());
    },

    displayElections: function() {
      if (this.electionLisById) {
        _.each(this.electionLisById, function(li) {
          li.remove();
        });
      }
      this.electionLisById = {};

      this.startLoading();

      var relationsToFetch = [
        this.organization().elections(),
        this.organization().elections().joinTo(Candidate),
        Application.currentUser().electionVisits()
      ];

      Server.fetch(relationsToFetch)
        .onSuccess(function() {
          this.stopLoading();
        var elections = this.organization().elections().orderBy('score desc');
        this.electionsList.relation(elections);
        this.subscribeToVisits(elections);
      }, this);
    },

    subscribeToVisits: function(elections) {
      this.subscriptions.add(elections.joinThrough(Application.currentUser().electionVisits()).onRemoteInsert(function(visit) {
        this.electionsList.elementForRecord(visit.election()).visited();
      }, this));
    },

    editOrganization: function(elt, e) {
      e.preventDefault();
      $.bbq.pushState({view: "editOrganization", organizationId: this.organizationId()}, 2);
    },

    startLoading: function() {
      this.loading.show();
    },

    stopLoading: function() {
      this.loading.hide();
    }
  }
});
