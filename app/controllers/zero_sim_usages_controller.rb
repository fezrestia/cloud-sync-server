class ZeroSimUsagesController < ApplicationController

  def index
    @zero_sim_usages = ZeroSimUsage.all

    @graph_data = []
    for log in @zero_sim_usages
      date = "#{log.year}/#{log.month}/#{log.day}"
      @graph_data.push(["#{date}", "#{log.month_used_current}"])
    end

  end

  def new
    @zero_sim_usage = ZeroSimUsage.new
  end

  def create
    @zero_sim_usage = ZeroSimUsage.new(zero_sim_usage_params)

    if @zero_sim_usage.save
      redirect_to "/zero_sim_usages/#{@zero_sim_usage.id}"
    else
      render 'new' # ZeroSimUsageController#new
    end
  end

  def show
    @zero_sim_usage = ZeroSimUsage.find(params[:id])
  end

  def edit
    @zero_sim_usage = ZeroSimUsage.find(params[:id])
  end

  def update
    @zero_sim_usage = ZeroSimUsage.find(params[:id])
    if @zero_sim_usage.update_attributes(zero_sim_usage_params)
      # Update succeeded.
      redirect_to zero_sim_usage_path(@zero_sim_usage.id)
    else
      # Update failed.
      render 'edit' # ZeroSimUsageController#edit
    end
  end

  def destroy
    @zero_sim_usage = ZeroSimUsage.find(params[:id])
    @zero_sim_usage.destroy

    redirect_to zero_sim_usages_path
  end

  # REST API.
  #
  def debug
    log_file_path = "#{Rails.root.to_s}/log/production.log"
    ret = "DEFAULT"

    File.open(log_file_path, 'r') do |file|
      ret = file.read
    end

    render text: ret
  end

  # REST API.
  #
  def sync
    require 'mechanize'

    # Return log string.
    ret = "API sync<br><br>"

    # Get 0 SIM stats.
    zero_sim_stats = get_zero_sim_stats
    yesterday_used_mb = zero_sim_stats[:yesterday_used_mb]
    month_used_current_mb = zero_sim_stats[:month_used_current_mb]

    # Yesterday log.
    yesterday = Time.zone.now.yesterday
    ret += "Yesterday = #{yesterday}<br>"
    yesterday_log = ZeroSimUsage.find_by(
        year: yesterday.year,
        month: yesterday.month,
        day: yesterday.day)
    if yesterday_log.nil?
      ret += "    New record is created.<br>"
      yesterday_log = ZeroSimUsage.new
      yesterday_log.year = yesterday.year
      yesterday_log.month = yesterday.month
      yesterday_log.day = yesterday.day
    else
      ret += "    Record is already existing.<br>"
    end
    yesterday_log.day_used = yesterday_used_mb
    ret += "    Data = #{yesterday_used_mb}<br>"
    if yesterday_log.save
      ret += "    Log.save SUCCESS<br>"
    else
      ret += "    Log.save FAILED<br>    #{yesterday_log.errors.full_messages}<br>"
    end

    ret += "<br>"

    # Today log.
    today = Time.zone.now
    ret += "Today = #{today}<br>"
    today_log = ZeroSimUsage.find_by(
        year: today.year,
        month: today.month,
        day: today.day)
    if today_log.nil?
      ret += "    New record is created.<br>"
      today_log = ZeroSimUsage.new
      today_log.year = today.year
      today_log.month = today.month
      today_log.day = today.day
    else
      ret += "    Record is already existing.<br>"
    end
    today_log.month_used_current = month_used_current_mb
    ret += "    Data = #{month_used_current_mb}<br>"
    if today_log.save
      ret += "    Log.save SUCCESS<br>"
    else
      ret += "    Log.save FAILED<br>    #{today_log.errors.full_messages}<br>"
    end

    # Return string.
    render text: ret
  end

  # REST API.
  #
  def notify
    # Get 0 SIM stats.
    zero_sim_stats = get_zero_sim_stats

    require 'net/https'

    uri = URI.parse("https://fcm.googleapis.com/fcm/send")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true
    http.verify_mode = OpenSSL::SSL::VERIFY_NONE

    request = Net::HTTP::Post.new(uri.path)
    request["Content-Type"] = "application/json"
    request["Authorization"] = "key=#{ENV['FCM_TOKEN']}"

    payload = "{
        \"notification\": {
            \"title\": \"0 SIM Stats\",
            \"text\": \"Current : #{zero_sim_stats[:month_used_current_mb]} MB/month\"
        },
        \"to\": \"dvbFOm_OuTc:APA91bGkjLfgGdrKMtVHZDWtI4dIEKnYUwzNAUqxKNmZpfzrc-aNfiiDH8Se_u_z1fEzv_z0zmhfLeSrylmLZq8tXMnyw2U1bCgGR-jX4jXMmZN7J2UTPA7qQtBp6Le76eH6GxtVmd5j\"
    }"
    request.body = payload

    response = http.request(request)

    render text: "CODE : #{response.code} / MSG : #{response.message}<br><br>BODY : <br>#{response.body}"
  end

private
  def zero_sim_usage_params
    params
        .require(:zero_sim_usage)
        .permit(:year, :month, :day, :day_used, :month_used_current)
  end

  # Get 0 SIM Stats.
  #
  # return hash
  #     :yesterday_used_mb
  #     :month_used_current_mb
  #
  def get_zero_sim_stats
    # Get data from so-net web.
    agent = Mechanize.new
    agent.user_agent_alias = 'Linux Mozilla'

    #TODO: Consider server down.

    # Login.
    login_page = agent.get('https://www.so-net.ne.jp/retail/u/')
    login_form = login_page.form_with(:name => 'Login')
    login_form.IDToken1 = ENV['ZERO_SIM_NUMBER']
    login_form.IDToken2 = ENV['ZERO_SIM_PASS']

    # Top page.
    top_page = agent.submit(login_form)

    # Usage page.
    usage_form = top_page.form_with(:name => 'userUsageActionForm')
    usage_page = agent.submit(usage_form)

    # Parse usage.
    usage_list = usage_page.search('//dl[@class="useConditionDisplay"]')
    yesterday_used_mb = usage_list.search('dd')[2].text.to_i
    month_used_current_mb = usage_list.search('dd')[0].text.to_i

    ret = {
        :yesterday_used_mb => usage_list.search('dd')[2].text.to_i,
        :month_used_current_mb => usage_list.search('dd')[0].text.to_i
    }

    return ret
  end

end
