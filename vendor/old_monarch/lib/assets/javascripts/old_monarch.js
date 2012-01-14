//= require jquery.ba-bbq
//= require htmlescape
//= require json
//= require md5
//= require old_monarch/language_extensions
//= require old_monarch/underscore_extensions
//= require old_monarch/foundation
//= require old_monarch/define_monarch
//= require old_monarch/jquery.monarch
//= require old_monarch/subscription_node
//= require old_monarch/subscription
//= require old_monarch/subscription_bundle
//= require old_monarch/future
//= require old_monarch/queue
//= require old_monarch/skip_list
//= require old_monarch/inflection
//= require old_monarch/view
//= require old_monarch/http
//= require old_monarch/model
//= require old_monarch/promise

(function(OldMonarch) {

Server = new OldMonarch.Http.Server();
Repository = new OldMonarch.Model.Repository();
History = new OldMonarch.View.History();

})(OldMonarch);