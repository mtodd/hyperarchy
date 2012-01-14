(function(OldMonarch) {

_.constructor("OldMonarch.Model.Predicates.Gt", OldMonarch.Model.Predicates.Binary, {
  operator: function(left, right) {
    return left > right;
  },

  type: "gt",

  forceMatchingFieldValues: function(fieldValues) {
    throw new Error("Can only force a field value for equality predicates");
  }
});

})(OldMonarch);