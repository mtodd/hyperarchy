_.constructor("Views.ColumnLayout.ColumnLi", View.Template, {
  content: function() {
    this.builder.tag("li", {'class': "column"});
  },

  viewProperties: {

    initialize: function() {
      this.views = {
//        organizations: Views.ColumnLayout.OrganizationsView.toView(),
//        votes:         Views.ColumnLayout.VotesView.toView(),
        elections:     Views.ColumnLayout.ElectionsView.toView(),
        candidates:    Views.ColumnLayout.CandidatesView.toView(),
        comments:      Views.ColumnLayout.CommentsView.toView()
      };
      _(this.views).each(function(view) {
        view.containingColumn = this;
        this.append(view.hide());
      }, this);
    },

    state: {
      afterChange: function(columnState, oldColumnState) {
        if (!columnState || _(columnState).isEqual(oldColumnState)) return;
        var viewName = columnState.tableName;
        this.switchToView(viewName);
        this.currentView.state(columnState);
      }
    },

    switchToView: function(viewName) {
      this.currentView = this.views[viewName];
      if (! this.currentView) this.handleInvalidState(this.state());
      this.children().hide();
      this.currentView.show();
    },

    setNextColumnState: function(newStateForNextColumn) {
      var newStateForThisColumn = _.clone(this.state());
      newStateForThisColumn.recordId = newStateForNextColumn.parentRecordId;
      newStateForThisColumn.childTableName = newStateForNextColumn.tableName;

      var columnNumber     = this.number;
      var lastColumnNumber = this.containingList.numOnScreenColumns() - 1;
      if (columnNumber === lastColumnNumber) {
        if (this.number == 1) newStateForThisColumn.parentTableName = null;
        this.containingList.scrollRightAndSetRightColumnState(newStateForNextColumn);
      } else {
        var nextColumn = this.containingList.onScreenColumns[columnNumber + 1];
        this.containingList.setColumnState(nextColumn, newStateForNextColumn);
      }
//      this.state(newStateForThisColumn);
    },

    showParent: function() {
      this.containingList.scrollLeft();
    },

    handleInvalidState: function(error) {
      this.containingList.handleInvalidState(error);
    },

    adjustHeight: function() {
      this.currentView.adjustHeight();
    }
  }
});
