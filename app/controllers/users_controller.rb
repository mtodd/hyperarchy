#  Copyright (c) 2010-2011, Nathan Sobo and Max Brunsfeld.  This file is
#  licensed under the Affero General Public License version 3 or later.  See
#  the COPYRIGHT file.

class UsersController < ApplicationController
  def new
    @user = User.new
  end

  def create
    errors = []
    Prequel.transaction do
      data = {}
      create_user(data, errors)
      create_organization(data, errors) if params[:organization]

      render :json => {
        'data' => data,
        'records' => build_client_dataset(current_user.initial_repository_contents)
      }

      return
    end

    render :status => 422, :json => errors
  end

  protected

  def create_user(data, errors)
    user = User.secure_create(params[:user])
    user.associate_referring_share(session[:share_code]) if session[:share_code]
    if user.valid?
      previous_user = current_user
      set_current_user(user)
      if organization = previous_user.guest_organization
        current_user.memberships.find_or_create!(:organization => organization)
      end
      data['current_user_id'] = user.id
    else
      errors.push(*user.errors.full_messages)
      raise Prequel::Rollback
    end
  end

  def create_organization(data, errors)
    organization = Organization.secure_create(params[:organization])
    if organization.valid?
      data['new_organization_id'] = organization.id
    else
      errors.push(*organization.errors.full_messages)
      clear_current_user
      raise Prequel::Rollback
    end
  end
end
