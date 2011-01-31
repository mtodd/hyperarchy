require File.expand_path("#{File.dirname(__FILE__)}/../../hyperarchy_spec_helper")

describe "POST /request_password_reset", :type => :rack do
  it "sets a password reset token on the user with the given email address and emails it to them" do
    Timecop.freeze(Time.now)
    user = User.make

    user.password_reset_token.should be_nil

    post "/request_password_reset", :email_address => user.email_address
    last_response.should be_redirect
    last_response.location.should == "/sent_password_reset_token"

    user.reload.password_reset_token.should_not be_nil
    user.password_reset_token_generated_at.should == Time.now

    Mailer.emails.length.should == 1
    email = Mailer.emails.first

    email[:to].should == user.email_address
    email[:body].should include(user.password_reset_token)
    email[:html_body].should include(user.password_reset_token)
  end

  it "redirects to get /request_password_reset if the email address is not found" do
    post "/request_password_reset", :email_address => "garbage"
    last_response.should be_redirect
    last_response.location.should == "/request_password_reset"
    flash[:errors].should_not be_nil
  end
end
