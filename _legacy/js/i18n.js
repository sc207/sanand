/* ============================================================
   TRILINGUAL LAYER — English / हिन्दी / ગુજરાતી
   Shri Vihat Meldi Dham
   ------------------------------------------------------------
   Loaded FIRST so t() / tData() are available everywhere.
   - Data ENTRY is always English (forms are not translated).
   - Data DISPLAY switches language: UI chrome via t(), and a
     fixed vocabulary of names (pooja types, categories,
     statuses, committees, cities, roles) via tData().
   - changeLanguage() re-applies [data-i18n*] attributes and
     calls every hook registered with onLanguageChange() so the
     dynamic modules (Pooja, Management) re-render.
   ============================================================ */

(function () {
  var LS_KEY = 'svmmm_lang';
  var LANGS = ['en', 'hi', 'gu'];

  var UI = {
    en: {
      /* generic actions / words reused everywhere */
      add:'Add', edit:'Edit', delete:'Delete', save:'Save', cancel:'Cancel', close:'Close',
      open:'Open', view:'View', back:'Back', remove:'Remove', confirm:'Confirm', search:'Search',
      export:'Export', print:'Print', preview:'Preview', reopen:'Reopen', yes:'Yes', no:'No',
      active:'Active', inactive:'Inactive', status:'Status', name:'Name', mobile:'Mobile',
      city:'City', state:'State', role:'Role', notes:'Notes', date:'Date', time:'Time',
      venue:'Venue', actions:'Actions', all:'All', none:'None', today:'Today', upcoming:'Upcoming',
      completed:'Completed', pending:'Pending',

      annc_kicker:"Today's Temple Updates", annc_update:'update', annc_updates:'updates',
      annc_today:'Today', annc_tomorrow:'Tomorrow', annc_in_days:'In {n} days',
      annc_view:'View details', annc_continue:'Continue to Dashboard',

      nav_dhaja:'🚩 Dhaja Pooja', cal_dhaja:'🚩 Dhaja', rep_dhaja:'Dhaja Pooja',
      dhaja_title:'Dhaja Pooja', dhaja_subtitle:"Sevarthis sponsor a dhaja — each sponsorship gets an 80G receipt",

      nav_yagna_signups:'🔥 Maha Yagna Signups',
      dhaja_sponsor_btn:'Sponsor a Dhaja', dhaja_register:'Sponsorship register',
      dhaja_campaigns:'Campaigns', dhaja_campaigns_meta:'February + special days',
      dhaja_sponsored:'Sponsored', dhaja_sponsored_meta:'Dhaja poojas booked',
      dhaja_raised:'Contributions', dhaja_raised_meta:'Total received',
      dhaja_remaining:'Remaining (108)', dhaja_remaining_meta:'To reach 108',
      dhaja_seq:'Seq', dhaja_receipt:'Receipt', dhaja_all:'All', dhaja_left:'left',
      dhaja_open:'Open', dhaja_from:'From', dhaja_received:'received', dhaja_day:'Day',
      dhaja_special_days:'Special-day dhaja', dhaja_open_sponsorship:'Open Dhaja sponsorship',
      dhaja_empty:'No dhaja campaigns yet. Open one from a special day below, or use “Sponsor a Dhaja”.',
      dhaja_none:'No sponsorships yet.', dhaja_search:'Search sponsor / receipt…',
      dhaja_form_campaign:'Campaign / occasion', dhaja_form_person:'Sevarthi (devotee)',
      dhaja_form_person_hint:'Pick the person from the register, or add a new devotee.',
      dhaja_form_amount:'Contribution (₹)', dhaja_form_date:'Receipt date',
      dhaja_form_scheduled:'Dhaja date (optional)', dhaja_form_notes:'Notes',
      dhaja_mark_done:'Done', dhaja_status_reserved:'Reserved', dhaja_status_sponsored:'Sponsored',
      dhaja_status_performed:'Performed', dhaja_status_cancelled:'Cancelled',
      dhaja_campaign_full:'That dhaja campaign is full / closed.', dhaja_campaign_closed:'Closed',
      dhaja_no_open:'No open dhaja campaign — open one from a special day first.',
      dhaja_pick_campaign:'Pick a campaign.', dhaja_bad_amount:'Enter a contribution amount.',
      dhaja_pick_person:'Pick or add the sevarthi.', dhaja_saved_local:'Saved locally — will sync when online.',
      dhaja_need_online:'Go online to open a special-day campaign.', dhaja_opened:'Dhaja sponsorship opened.',
      dhaja_cancel_title:'Cancel this dhaja sponsorship?', dhaja_cancel_body:'The linked donation and its receipt will be voided.',
      dhaja_new_campaign:'New Campaign', dhaja_edit_campaign:'Edit Dhaja Campaign',
      dhaja_camp_created:'Campaign created.', dhaja_camp_deleted:'Campaign deleted.',
      dhaja_camp_need_name:'Enter a campaign name.', dhaja_camp_delete_title:'Delete campaign?',
      dhaja_camp_delete_body:'Remove this dhaja campaign?',
      dhaja_camp_has_sponsors:'This campaign has {n} sponsorship(s). Delete it and void their receipts?',
      dhaja_camp_general_keep:'The General campaign cannot be deleted.',
      dhaja_add_special_day:'Add special day', dhaja_no_special:'No special days yet — add one above.',
      dhaja_no_annual_form:'Add the special day from the Events page.',
      dhaja_general_all:'Every dhaja pooja — all occasions',
      dhaja_start_campaign:'Start a campaign', dhaja_tithi_ref:'Temple tithis this year',
      dhaja_tithi_hint:'A date reference. “Start a campaign” pre-fills a new dhaja campaign for that day — it does not change the temple calendar.',
      dhaja_add_tile_hint:'February mahotsav, a special day, or any occasion', dhaja_camp_form_missing:'Reload the page and try again.',

      temple_name:'Shri Vihat Meldi Dham',
      temple_loc:'Sanand, Gujarat',
      sub_tagline:'Sanand, Gujarat — Central Management Platform',
      sign_in:'🔐 Sign In', sign_out:'Sign Out', administrator:'Administrator',
      search_placeholder:'Search anything…', search_none:'No matches. Try a name, receipt number or section.', search_action:'Quick action', add_devotee:'Register Devotee',

      nav_main:'Main Navigation', nav_ops:'Platform & Operations', nav_grp_overview:'Overview', nav_grp_seva:'Seva & Events', nav_grp_people:'People & Governance', nav_grp_resources:'Donations & Resources', nav_grp_admin:'Administration', rep_downloads:'Downloadable registers', set_founder:'Temple Founder / મંદિર સ્થાપક', set_head:'Temple Head / મંદિર પ્રમુખ', exp_word:'Export',
      nav_dashboard:'🏠 Dashboard', nav_puja:'🪔 Pooja & Seva', nav_donations:'💰 Donations',
      nav_devotees:'👥 Devotees', nav_management:'🗂️ Management Apps',
      nav_committees:'🏛️ Committee / Samaj', nav_teams:'👷 Staff & Teams', nav_events:'📅 Events',
      nav_invite:'🎴 Combined Invitation',
      dv_title:'Devotees 360°', dv_sub:'Every devotee and everything the temple links to them',
      dv_register:'Devotee Register', dv_add:'Add devotee', dv_edit:'Edit devotee', dv_none:'No devotees match.', dv_full_name:'Full name',
      dv_samaj:'Samaj', dv_no_samaj:'No samaj',
      dv_category:'Category', dv_category_all:'All Categories', dv_committee_all:'All Committees',
      dv_cat_normal:'Normal', dv_cat_vip:'VIP', dv_cat_guest:'Guest', dv_cat_gurudev_bhuvaji:'Gurudev/Bhuvaji',
      pj_inv_aud_category:'Category', pj_inv_aud_category_all:'All categories',
      pj_inv_aud_cat_hint:'Narrow the audience above to one devotee category — combine with a committee (e.g. "VIP members of Rabari Samaj Committee"), or leave the committee as Open/public and pick just a category to invite every matching devotee temple-wide.',
      dv_samaj_ph:'community label, e.g. Rabari Samaj',
      dv_committees_pick:'Committees',
      dv_cmt_sync_fail:'Some committee changes did not sync.',
      all_samaj:'All Samaj / community',
      dv_committees:'Committees', dv_teams:'Teams', dv_visits:'Visits to location', dv_joined:'Joined',
      dv_donated:'donated', dv_total_received:'Total received', dv_total_pledged:'Pledged',
      dv_kpi_total:'Registered Devotees', dv_kpi_linked:'Actively Linked',
      dv_kpi_linked_meta:'On a committee, team, seva, visit or donation',
      dv_kpi_donated:'Total Received (₹)', dv_kpi_upcoming:'Upcoming Engagements',
      dv_kpi_upcoming_meta:'Seva, coordination, guest & visits ahead',
      dv_k_seva:'Sevarthi of', dv_k_coord:'Coordinates', dv_k_vol:'Volunteer in', dv_k_guest:'Guest at',
      dv_roles:'Roles & Memberships', dv_no_roles:'Not on any committee or team yet.',
      dv_no_upcoming:'Nothing upcoming', dv_history:'Completed & History', dv_no_history:'No completed activity yet',
      dv_ledger:'Ledger — oldest first', dv_ledger_sub:'Chronological record of every temple engagement',
      dv_print_ledger:'Print ledger PDF', dv_no_ledger:'No linked activity yet.',
      dv_col_devotee:'Devotee', dv_col_type:'Type', dv_col_detail:'Detail', dv_col_amount:'Amount (₹)',
      dv_col_pooja:'Pooja / Seva', dv_col_sessions:'Session date(s)',
      dv_as_sevarthi:'As Sevarthi', dv_as_coord:'As Coordinator', dv_as_guest:'Guest appearances',
      dv_sev_status:'Sevarthi status', dv_guest_role:'Guest role',
      dv_visits_sec:'Padhramani visits', dv_pledged_don:'Pledged donations', dv_received_don:'Received donations',
      dv_events_led:'Events led', dv_cmte_lead:'Committee Lead', dv_team_lead:'Team Lead',
      dv_leader:'Leader', dv_lead:'Lead',
      dv_no_don_match:'No donation record matched this mobile number.',
      dv_no_don_mobile:'Add a mobile number to match this person to donation records.',
      dv_advice:'A devotee is one shared person record — the same record is reused wherever the person appears (committee member, team volunteer, sevarthi, coordinator, guest, donor). Edits here reflect everywhere.',
      dv_need_name:'Name is required.', dv_need_mobile:'Mobile must be 10 digits.',
      dv_export_title:'Devotees 360° — Register',
      dv_export_sub:'All devotees with linked committees, teams, seva, visits and donations',
      nav_inventory:'📦 Inventory', nav_expenses:'💸 Expenses', nav_visits:'🙏 Bappa / Bhuvaji Visits',
      nav_calendar:'🗓️ Unified Calendar', nav_reports:'📊 Reports', nav_settings:'⚙️ Settings',
      nav_admin:'🛡️ Accounts & Access',

      /* dashboard */
      banner_headline:'જય શ્રી વિહત મેલડી ધામ',
      banner_tagline:'માતાજીની કૃપા, ભક્તોની શ્રદ્ધા',
      banner_khamma:'ખમ્મા માડી, ખમ્મા 🙏',
      welcome_back:'Welcome back',
      kpi_seva:"Today's Seva Bookings", kpi_donations:"Today's Donations",
      kpi_devotees:'Registered Devotees', kpi_visits:'Temple Visits Today',
      quick_actions:'Operational Quick Actions', modules_launcher:'Management Modules Launcher',
      todays_overview:"Today's Overview", recent_activity:'Recent Activity',

      action_book_seva:'Book Seva', action_record_donation:'Record Donation',
      action_add_devotee:'Add Devotee', action_add_expense:'Add Expense',
      action_qr_badge:'QR Badge', action_events:'Events', action_inventory:'Inventory',
      action_reports:'Reports',

      mob_home:'Home', mob_seva:'Seva', mob_donations:'Donations', mob_devotees:'Devotees',
      mob_management:'Teams', mob_more:'More',

      /* pooja module */
      /* Annual Temple Events */
      ann_title:'Annual Temple Events', ann_title_gu:'મંદિરના વાર્ષિક પ્રસંગો', ann_year:'Year', ann_add:'Add event',
      ann_none:'No annual events.', ann_disabled:'Disabled', ann_scheduled:'Scheduled', ann_disabled_t:'Event disabled.', ann_enabled:'Event enabled.',
      ann_src_pinned:'pinned', ann_src_fixed:'fixed date', ann_src_calc:'calculated', ann_fixed:'fixed date',
      ann_verify:'Calculated — confirm against the temple panchang and pin if needed.',
      ann_no_date:'Could not calculate for this year — pin the correct date.', ann_not_set:'date not set — pin it',
      ann_make_pooja:'Create Seva/Pooja', ann_make_invite:'Create Invitation', ann_pin:'Pin date',
      ann_disable:'Disable', ann_enable:'Enable', ann_from:'Created from annual event', ann_created:'Seva/Pooja created',
      ann_pin_help:'Set the exact Gregorian date for this year from the temple panchang. It overrides the calculation for this year only.',
      ann_unpin:'Remove pin', ann_bad_date:'Choose a valid date.', ann_unpinned:'Pin removed.', ann_pinned:'Date pinned.',
      ann_name_en:'Name (English) *', ann_name_gu:'Name (Gujarati)', ann_act_en:'Activity (English)', ann_act_gu:'Activity (Gujarati)',
      ann_type:'Type', ann_type_tithi:'Tithi (Hindu calendar)', ann_type_fixed:'Fixed Gregorian date', ann_active:'Active',
      ann_masa:'Gujarati month (masa)', ann_paksha:'Paksha', ann_tithi:'Tithi (1–15)', ann_month:'Month (1–12)', ann_day:'Day (1–31)',
      ann_notes:'Notes', ann_need_name:'Name is required.', ann_title_annual_event:'Annual Temple Event',
      ann_once:'One-time event — happens only in the year below, does not repeat every year',
      ann_once_year:'Year', ann_once_badge:'one-time', ann_once_hint:'One-time event — will not repeat next year',
      ev_festival_title:'Festival programmes & mahotsavs',
      ev_festival_sub:'One-off multi-day programmes with a venue, in-charge, budget and expected footfall — separate from the recurring Tithi calendar above.',
      ev_festival_empty:'No festival programmes yet. Use “Add Event” to plan a mahotsav, dayro or seva programme.',
      ev_type_empty:'Optional — add reusable categories (Navratri, Annakut, Dayro…) to group festival programmes. Not needed for the Tithi calendar.',
      pj_title:'Pooja & Seva', pj_my_title:'My Poojas',
      pj_sub_admin:'Create pooja events, record sevarthis, assign coordinators and print invitations',
      pj_sub_coord:'Open a Pooja assigned to you',
      pj_add:'Add Pooja', pj_export:'Export CSV',
      pj_kpi_total:'Total Poojas', pj_kpi_upcoming:'Upcoming', pj_kpi_sevarthis:'Sevarthis',
      pj_kpi_types:'Pooja Types',
      pj_open_ws:'Open a Pooja Workspace', pj_directory:'Pooja Directory',
      pj_col_id:'Pooja ID', pj_est_seva:'Est. Seva (INR)',
      pj_col_pooja:'Pooja', pj_actions:'Actions', pj_sort_date:'Sort by date (nearest first)',
      pj_people_registry:'Guests', pj_type_catalog:'Ritual Type Catalog',
      pj_schedule_btn:'Schedule Pooja / Seva', pj_scheduled:'Scheduled Poojas & Sevas',
      pj_view_cards:'Cards', pj_view_table:'Table',
      pj_setup:'Setup — ritual type catalog & people',
      pj_catalog_hint:'Reusable ritual definitions. You pick one of these when you schedule a Pooja.',
      pj_add_type_btn:'Add Ritual Type', pj_guests_hint:'Priests & special guests you can attach to any Pooja.',
      pj_flow_1_t:'Set up ritual types', pj_flow_1_d:'Reusable templates in the Catalog — name, samagri, duration. No dates.',
      pj_flow_2_t:'Schedule a Pooja / Seva', pj_flow_2_d:'Pick a type, set the date(s), venue, sevarthi and guests.',
      pj_flow_3_t:'Open a Pooja', pj_flow_3_d:'Manage sevarthi, print invitations, track the calendar.',
      pj_tab_overview:'Overview', pj_tab_sevarthi:'Sevarthi', pj_tab_invitation:'Invitation',
      pj_tab_calendar:'Calendar', pj_tab_settings:'Settings', pj_tab_activity:'Activity',
      pj_sevarthi_records:'Sevarthi Records',
      pj_sevarthi_sub:'Devotees who have taken the seva of this pooja',
      pj_add_sevarthi:'Add Sevarthi', pj_add_guest:'Add Guest',
      pj_new_guest:'+ Add new Guest',
      pj_session_schedule:'Session Schedule', pj_manage_sessions:'Manage Sessions',
      pj_pooja_details:'Pooja Details', pj_guests_pandits:'Guests',
      pj_invitation_card:'Invitation Card',
      pj_invitation_sub:'Auto-filled from the pooja. Tweak the copy and style, then print or save as PDF (A5).',
      pj_calendar:'Pooja Calendar', pj_settings:'Pooja Settings', pj_activity:'Activity Log',
      pj_mark_completed:'✓ Mark Completed', pj_mark_extended:'Mark Extended',
      pj_cancel_pooja:'Cancel Pooja', pj_reopen_pooja:'Reopen Pooja',
      pj_schedule:'Schedule', pj_next_session:'Next Session', pj_days_to_go:'Days To Go',
      pj_people:'People', pj_coordinator:'Coordinator', pj_sevarthi:'Sevarthi',
      pj_type:'Type', pj_single_event:'Single event', pj_multi_session:'Multi-session',
      pj_no_sevarthi:'No sevarthi yet', pj_no_guests:'No guests added.',
      pj_today_is:'Today is',
      pj_status_auto_note:'status updates automatically from the session dates unless you set it here.',

      pj_st_planned:'Upcoming', pj_st_today:'Happening Today', pj_st_completed:'Completed',
      pj_st_extended:'Extended', pj_st_cancelled:'Cancelled',
      civ_title:'Combined Invitation', civ_sub:'Select any poojas already added and build one combined invitation card listing all of them together.',
      civ_pick_poojas:'Select Poojas', civ_no_poojas:'No poojas have been added yet.',
      civ_select_all:'Select all', civ_clear_all:'Clear',
      civ_empty_preview:'Select one or more poojas to build the combined card.',
      civ_default_headline:'Forthcoming Poojas & Seva',
      civ_need_pooja:'Select at least one pooja first.', civ_no_date:'No date set',
      civ_pages_total:'pages', civ_pages_each:'each',
      civ_show_time:'Show session time', civ_show_time_hint:'Turn off to fit more poojas per page — each row keeps just the day and date.',

      don_title:"Donations", don_sub:"Cash & in-kind offerings, 80G receipts and Dhanyavaad certificates", don_record:"Record Donation", don_edit:"Edit Donation", don_kpi_cash:"Cash This Month", don_kpi_kind:"In-Kind This Month", don_kpi_kind_meta:"Estimated value received", don_kpi_donors:"Registered Donors", don_kpi_donors_meta:"Individuals, companies & trusts", don_kpi_pledged:"Pledged", don_kpi_pledged_meta:"Awaiting realisation", don_register:"Donation Register", don_donor_registry:"Donor Registry", don_categories:"Donation Categories", don_category:"Category", don_add_donor:"Add Donor", don_add_category:"Add Category", don_edit_category:"Edit Category", don_edit_donor:"Edit Donor", don_receipt_no:"Receipt No", don_donor:"Donor", don_given:"Donation", don_value:"Value", don_donor_type:"Type", don_lifetime:"lifetime", don_received:"Received", don_pledged:"Pledged", don_receipt:"Receipt", don_certificate:"Certificate", don_est_value:"est. value", don_none:"No donations match.", don_no_donors:"No donors on record.", don_records:"record(s)", don_unused:"Not used yet", don_kind:"In-kind", don_cash:"Cash", don_select_donor:"Select a donor", don_no_pan:"PAN not on file", don_history:"Donation History", don_contact_person:"Contact person", don_committee:"Committee / Samaj", don_save_receipt:"Save & Issue Receipt", don_saved:"Donation recorded", don_updated:"Donation updated", don_deleted:"Donation deleted", don_delete_title:"Delete Donation", don_delete_body:"Delete the record for", don_pick_donor:"Please choose a donor.", don_pick_category:"Please choose a category.", don_need_item:"Describe the article donated.", don_need_value:"Enter an estimated value.", don_need_amount:"Enter the donation amount.", don_donor_exists:"A donor with this mobile already exists", don_edit_instead:"Open that record to edit it.", don_need_name:"Donor name is required.", don_need_org:"Organisation name is required.", don_need_mobile:"Mobile must be 10 digits.", don_bad_pan:"PAN format looks wrong (ABCDE1234F).", don_donor_added:"Donor added", don_donor_updated:"Donor updated", don_donor_deleted:"Donor deleted", don_delete_donor:"Delete Donor", don_delete_donor_body:"Delete the donor", don_donor_in_use:"{n} donation(s) reference this donor - cannot delete.", don_need_cat_name:"Category name is required.", don_cat_exists:"That category name already exists.", don_cat_added:"Category added", don_cat_updated:"Category updated", don_cat_deleted:"Category deleted", don_delete_category:"Delete Category", don_delete_cat_body:"Delete the category", don_cat_in_use:"{n} donation(s) use this category.", don_receipt_title:"Official Temple Receipt (80G)", don_cert_title:"Dhanyavaad Certificate", call:"Call", cmt_title:"Committee / Samaj", cmt_my_title:"My Committees", cmt_all:"All Committees", cmt_sub_admin:"Committees for the temple construction - leaders, members, meetings and attendance", cmt_sub_lead:"Open a committee assigned to you", cmt_add:"Add Committee", cmt_create:"Create Committee", cmt_edit:"Edit Committee", cmt_delete:"Delete Committee", cmt_kpi_total:"Committees", cmt_kpi_total_meta:"Across the platform", cmt_kpi_members:"Members", cmt_kpi_members_meta:"Registered across committees", cmt_kpi_meetings:"Meetings This Month", cmt_kpi_attendance:"Avg Attendance", cmt_kpi_attendance_meta:"This month", cmt_none:"No committee assigned", cmt_none_admin:"Create your first committee.", cmt_none_lead:"No committee has been assigned to you yet.", cmt_open_ws:"Open a Committee Workspace", cmt_leader:"Leader", cmt_members:"Members", cmt_attendance:"Attendance", cmt_next:"Next", cmt_no_meeting:"No meeting scheduled", cmt_expected:"Expected", cmt_seats:"seats", cmt_active_members:"Active", cmt_tab_overview:"Overview", cmt_tab_members:"Members", cmt_tab_meetings:"Meetings", cmt_tab_calendar:"Calendar", cmt_tab_whatsapp:"WhatsApp", cmt_tab_settings:"Settings", cmt_tab_activity:"Activity", cmt_add_member:"Add Member", cmt_edit_member:"Edit Member", cmt_schedule:"Schedule Meeting", cmt_edit_meeting:"Edit Meeting", cmt_meeting:"Meeting", cmt_meetings_word:"Meetings", cmt_meetings_sub:"Schedule meetings and mark attendance", cmt_upcoming_meetings:"Upcoming Meetings", cmt_completed_meetings:"Completed Meetings", cmt_no_upcoming:"No upcoming meetings.", cmt_no_completed:"No completed meetings yet.", cmt_no_meetings:"No meetings assigned.", cmt_no_meetings2:"No meetings scheduled yet.", cmt_no_members:"No members yet.", cmt_no_activity:"No activity.", cmt_no_drafts:"No drafts yet.", cmt_joined:"joined", cmt_also_in:"Also in", cmt_deactivate:"Deactivate", cmt_activate:"Activate", cmt_present:"Present", cmt_absent:"Absent", cmt_not_marked:"Not marked", cmt_invited:"Invited", cmt_scheduled:"Scheduled", cmt_running:"Running", cmt_done:"Completed", cmt_agenda:"Agenda", cmt_attendance_list:"Attendance List", cmt_attendance_history:"Attendance History", cmt_all_present:"Mark All Present", cmt_all_absent:"Mark All Absent", cmt_complete:"Complete Meeting", cmt_complete_note:"Once completed, attendance becomes read-only.", cmt_meeting_done:"Meeting completed.", cmt_locked:"This meeting is completed. Attendance is read-only.", cmt_locked_short:"Locked", cmt_calendar:"Meeting Calendar", cmt_settings:"Committee Settings", cmt_settings_admin:"Full settings including leader assignment", cmt_settings_lead:"Leaders can edit committee details. Leader assignment is admin-only.", cmt_activity_log:"Activity Log", cmt_whatsapp:"WhatsApp Communication", cmt_whatsapp_sub:"Group, broadcast and reusable draft messages", cmt_group:"WhatsApp Group", cmt_group_name:"Group Name", cmt_group_link:"Group Invite Link", cmt_broadcast:"Broadcast", cmt_broadcast_name:"Broadcast Name", cmt_broadcast_link:"Broadcast Link", cmt_open_group:"Open Group", cmt_open_broadcast:"Open Broadcast", cmt_drafts:"Message Drafts", cmt_new_draft:"New Draft", cmt_edit_draft:"Edit Draft", cmt_delete_draft:"Delete Draft", cmt_draft_deleted:"Draft deleted.", cmt_updated:"Updated", cmt_copy:"Copy", cmt_send:"Send", cmt_copied:"Copied.", cmt_copied_paste:"Message copied - paste it in WhatsApp.", cmt_sent:"Message sent", cmt_no_link:"No link saved yet.", cmt_name:"Committee Name", cmt_samaj:"Samaj", cmt_expected_size:"Expected Size", cmt_colour:"Colour", cmt_purpose:"Purpose", cmt_select_leader:"Select leader", cmt_access_denied:"Access denied.", cmt_admin_only:"Only an administrator can do this.", cmt_leader_access:"Committee Leader access. You can only open:", cmt_need_name:"Name is required.", cmt_need_leader:"Assign a leader.", cmt_need_purpose:"Purpose is required.", cmt_delete_body:"This deletes the committee, its members, meetings and attendance.", cmt_created:"Committee created", cmt_deleted:"deleted", cmt_updated_by:"Committee updated by", cmt_already_member:"is already on this committee.", cmt_existing_devotee:"Existing devotee", cmt_will_link:"will be linked, not duplicated.", cmt_need_member_name:"First and last name are required.", cmt_need_mobile:"Mobile must be 10 digits.", cmt_added_word:"added", cmt_removed:"removed", cmt_deactivate_body:"They stop appearing in new meetings but history is kept.", cmt_remove_member:"Remove Member", cmt_remove_body:"Removes the committee assignment and its attendance rows. The devotee record is kept.", cmt_no_active_members:"No active members yet.", cmt_need_meeting_title:"Meeting title is required.", cmt_need_datetime:"Date and time are required.", cmt_end_after_start:"End time must be after start time.", cmt_pick_members:"Invite at least one member.", cmt_meeting_updated:"Meeting updated.", cmt_meeting_scheduled:"Meeting scheduled", cmt_delete_meeting:"Delete Meeting", cmt_meeting_deleted:"Meeting deleted.", cmt_need_draft:"Title and message are required.", cmt_no_meeting_row:"No meetings.", ev_title:"Temple Events", ev_sub:"Festivals, mahotsavs and seva programmes", ev_add:"Add Event", ev_edit:"Edit Event", ev_delete:"Delete Event", ev_deleted:"Event deleted.", ev_created:"Event created", ev_updated:"Event updated", ev_kpi_total:"Total Events", ev_kpi_total_meta:"On the calendar", ev_kpi_upcoming:"Upcoming", ev_kpi_upcoming_meta:"Still to come", ev_kpi_footfall:"Expected Footfall", ev_kpi_types:"Event Types", ev_kpi_types_meta:"Master list", ev_open_ws:"Open an Event", ev_type_catalog:"Event Type Master List", ev_type:"Type", ev_add_type:"Add Event Type", ev_edit_type:"Edit Event Type", ev_delete_type:"Delete Event Type", ev_type_exists:"That type already exists.", ev_type_in_use:"event(s) use this type.", ev_type_deleted:"Type deleted.", ev_records:"event(s)", ev_unused:"Not used yet", ev_days:"days", ev_day:"day", ev_incharge:"In-charge", ev_footfall:"Footfall", ev_budget:"Budget", ev_estimate:"Estimate", ev_schedule:"Schedule", ev_manage_days:"Manage Days", ev_notice:"Notice / Invite", ev_no_date:"No date", ev_tab_overview:"Overview", ev_tab_schedule:"Schedule", ev_tab_settings:"Settings", ev_tab_activity:"Activity", ev_st_planning:"Planning", ev_st_confirmed:"Confirmed", ev_st_ongoing:"Ongoing", ev_st_completed:"Completed", ev_st_cancelled:"Cancelled", ev_select_type:"Select type", ev_select_incharge:"Select in-charge", ev_need_name:"Event name is required.", ev_need_type:"Select an event type.", ev_need_day:"Add at least one day.", ev_end_after:"End time must be after start time.", ev_invite_line:"You are cordially invited to", vis_title:"Bappa / Bhuvaji Visits", vis_sub:"Padhramani to homes, shops and family functions - with an escort team", vis_add:"Add Visit", vis_add_devotee:"Add new devotee", vis_pick_devotee:"pick a devotee", vis_not_in_register:"not in register", vis_edit:"Edit Visit", vis_delete:"Delete Visit", vis_deleted:"Visit deleted.", vis_added:"Visit added.", vis_kpi_total:"Total Visits", vis_kpi_upcoming:"Upcoming", vis_kpi_upcoming_meta:"Scheduled / confirmed", vis_kpi_pending:"Awaiting Approval", vis_kpi_pending_meta:"New requests", vis_kpi_teams:"Escort Teams", vis_kpi_teams_meta:"On the roster", vis_register:"Visit Register", vis_devotee:"Devotee", vis_purpose:"Purpose", vis_address:"Address", vis_datetime:"Date & Time", vis_escort:"Escort Team", vis_none:"No visits match.", vis_escort_ph:"Team that carries the palki & manages the visit", vis_need_name:"Devotee name is required.", vis_need_date:"Date is required.", vis_explain:"A padhramani is when Maa's murti or the Bhuvaji (the temple oracle / medium) is taken to a devotee's home, shop or family function for a blessing. The escort team is the volunteer group that carries the palki, manages the aarti thali and crowd, keeps the murti safe and handles the return journey.", vis_p_home_inauguration:"New Home / Vastu", vis_p_shop_opening:"Shop Opening", vis_p_wedding_blessing:"Wedding Blessing", vis_p_health_blessing:"Health / Recovery", vis_p_business_puja:"Business / Factory Puja", vis_p_festival_padhramani:"Festival Padhramani", vis_p_other:"Other", vis_s_requested:"Requested", vis_s_scheduled:"Scheduled", vis_s_confirmed:"Confirmed", vis_s_completed:"Completed", vis_s_cancelled:"Cancelled", cal_title:"Unified Temple Calendar", cal_sub:"Poojas, committee meetings, events, pledges and visits - all in one place", cal_sub_public:"Poojas, events and annual Tithi dates across the temple", cal_next:"Next", cal_up_next:"Up Next", cal_agenda:"This month", cal_item:"Item", cal_type:"Type", cal_nothing:"Nothing scheduled this month.", cal_poojas:"Poojas", cal_meetings:"Meetings", cal_events:"Events", cal_annual:"Annual", cal_donations:"Pledges", cal_visits:"Visits", cal_pledge:"Pledged donation", cal_mon:"Mon", cal_tue:"Tue", cal_wed:"Wed", cal_thu:"Thu", cal_fri:"Fri", cal_sat:"Sat", cal_sun:"Sun", cal_more:"more", mg_lead:"Management Lead", mg_volunteer:"Volunteer", mg_id:"ID", pj_inv_royal:"Royal (ceremonial)", pj_inv_cream:"Cream (minimal)", pj_inv_festival:"Festival (celebratory)", pj_inv_lang_app:"Same as app", pj_inv_template:"Template", pj_inv_language:"Card Language", pj_inv_accent:"Accent Colour", pj_inv_headline:"Headline", pj_inv_line:"Invitation Line", pj_inv_blessing:"Closing Blessing", pj_inv_show_schedule:"Show full session schedule", pj_inv_show_sevarthi:"Show sevarthi name(s)", pj_inv_show_guests:"Show guests", pj_inv_save:"Save Card", pj_inv_print:"Print / Save PDF", pj_inv_audience:"Invite (audience)", pj_inv_aud_open:"Open / public invitation (no name)", pj_inv_aud_grp:"One card per committee member", pj_inv_aud_hint:"Pick a samaj / committee to generate a personalised card (name, city, state) for every member — one page each in the PDF.", pj_inv_aud_preview:"Preview shows 1 of", pj_inv_aud_pdf:"Print / Save PDF generates all", pj_inv_aud_onepage:"one invitation per page", pj_inv_download:"Download all (1 PDF)", pj_inv_print_only:"Print", pj_inv_dl_wait:"Building…", pj_inv_dl_prog:"Rendering", pj_inv_dl_ok:"invitation page(s) saved as PDF.", pj_inv_dl_offline:"PDF engine unavailable — opening print view instead.", pj_inv_dl_fail:"PDF generation failed — opening print view instead.", pj_inv_zip:"Download ZIP (individual)", pj_inv_zip_prog:"Packing", pj_inv_zip_ok:"invitation PDFs saved as a ZIP.", pj_inv_zip_fail:"ZIP generation failed — opening print view instead.", pj_inv_sub2:"Auto-filled from the pooja. Adjust the copy, colour and language, then print or save as PDF (A5).", pj_edit_pooja:'Edit Pooja', pj_all_poojas:'All Poojas', pj_sessions_word:'sessions', dash_kpi_pooja:'Today\'s Poojas', dash_kpi_don:'Donations This Month', dash_kpi_accounts:'Authorized Accounts', dash_kpi_accounts_meta:'With platform access', dash_kpi_month:'This Month', dash_glance:'Your temple at a glance',
      guide_title:'New here? How this platform works', guide_reopen:'Guide', guide_hide:'Got it — hide this',
      guide_lead:'One platform for the whole temple. Pick a section from the sidebar, or use the shortcuts below. Every list has an “Add” button top-right, and every record opens a workspace with tabs.',
      guide_modules:'What each section is for', guide_tasks:'Common tasks — where to go', guide_glossary:'Words used here',
      guide_m_puja:'Schedule rituals & sevas, record sevarthi, print invitations',
      guide_m_events:'Plan festivals — Navratri, Annakut, Patotsav',
      guide_m_visits:'Take the murti / Bhuvaji to a home or shop, with an escort team',
      guide_m_devotees:'The master register used across donations, poojas & committees',
      guide_m_cmt:'Construction governance bodies — members, meetings, attendance',
      guide_m_mg:'Volunteer teams — prasad, parking, decoration — rosters & badges',
      guide_m_don:'Cash & in-kind offerings, 80G receipts & certificates',
      guide_m_exp:'Log temple spending against vouchers',
      guide_m_inv:'Samagri, prasad & assets, with low-stock alerts',
      guide_m_cal:'Every dated item from every section on one grid',
      guide_m_rep:'Live month figures + downloadable registers (CSV / Excel / PDF)',
      guide_m_acc:'Who has a login and what each person can open; audit trail',
      guide_m_set:'Temple identity, language, and the working date that drives reports',
      guide_t_don:'Record a donation & print an 80G receipt', guide_t_pooja:'Schedule a pooja or festival seva',
      guide_t_fest:'Plan a festival (Navratri, Annakut…)', guide_t_visit:'Send Bappa / Bhuvaji to a home or shop',
      guide_t_team:'Start a volunteer team (parking, prasad…)', guide_t_login:'Give someone login access',
      guide_t_date:'Change the working date or temple details',
      guide_g_sevarthi:'The devotee family that sponsors and performs a pooja as seva.',
      guide_g_padh_k:'Padhramani / Bhuvaji visit', guide_g_padh:"Taking Maa's murti or the Bhuvaji to a devotee's home or shop for a blessing.",
      guide_g_cvm_k:'Committee vs Management', guide_g_cvm:'Committee = construction governance bodies. Management = operational volunteer teams.',
      guide_g_date_k:'Working date', guide_g_date:'The "today" every dashboard, report and status is measured against — set it in Settings.',
      guide_g_scope_k:'"Viewing as" (top bar)', guide_g_scope:'Preview the app as a limited login would see it. Switch back to Administrator any time.', dash_attention:'Needs attention', dash_today_temple:'Today across the temple', dash_today_area:'Today in your area', dash_today:'today', dash_quiet:'A quiet day — nothing scheduled.', dash_your_area:'Your area', dash_no_assign:'Nothing assigned to you yet.', dash_on_file:'on file', dash_items:'items', dash_vouchers:'vouchers', dash_a_pledged:'donation pledge(s) awaiting realisation', dash_a_visits:'Bhuvaji visit request(s) to approve', dash_a_sevarthi:'pooja(s) with no sevarthi recorded', dash_a_stock:'inventory item(s) low or out of stock', dash_a_attend:'committee(s) with low meeting attendance', nav_puja_s:'Pooja & Seva', nav_management_s:'Management Apps', nav_devotees_s:'Devotees', nav_inventory_s:'Inventory', nav_expenses_s:'Expenses', role_superadmin:'Super Admin', role_admin:'Administrator', role_management_lead:'Management Lead', role_pooja_coordinator:'Pooja Coordinator', role_committee_leader:'Committee Leader', role_event_incharge:'Event In-charge', role_accountant:'Accountant', acc_title:'Accounts & Access', acc_sub:'Every authorized account, what it can open, and a live audit trail', acc_kpi_total:'Authorized Accounts', acc_kpi_total_meta:'Across all roles', acc_kpi_admin:'Super Admins', acc_kpi_admin_meta:'Full platform access', acc_kpi_leaders:'Leaders & Coordinators', acc_kpi_leaders_meta:'Scoped to their area', acc_kpi_roles:'Access Roles', acc_kpi_roles_meta:'Defined role types', acc_by_role:'Access by role', acc_can_open:'Can open', acc_everything:'everything', acc_accounts:'Accounts', acc_account_ct:'account(s)', acc_roles:'Roles', acc_signin:'Sign in as', acc_audit:'Audit Trail', acc_audit_meta:'live, merged from every module', acc_module:'Module', acc_action:'Action', acc_when:'When', acc_ref_title:'Roles & access reference', acc_ref_sub:'The fixed role model. Only superadmin and admin see this.', acc_ref_role:'Role', acc_ref_open:'Pages it may open', acc_ref_dash:'Dashboard it sees', acc_ref_cal:'In the calendar', acc_ref_pages:'pages', rep_title:'Reports & Analytics', rep_sub:'Figures pulled live from every module for the current month', rep_export_all:'Export activity log', rep_don:'Donations (cash, month)', rep_donkind:'In-kind Value (month)', rep_exp:'Expenses (total)', rep_dev:'Registered Devotees', rep_pooja:'Poojas', rep_cmt:'Committee Attendance', rep_ev:'Events', rep_vis:'Bhuvaji Visits', set_title:'Platform Settings', set_sub:'Temple identity, language and demo data', set_identity:'Temple Identity', set_name:'Temple Name', set_loc:'Location', set_email:'Contact Email', set_phone:'Contact Phone', set_platform:'Platform', set_lang:'Default Language', set_clock:'Demo Clock', set_accounts_hint:'Manage who can access the platform in the', set_page:'page', set_reset:'Fresh load — reset all demo data', set_clock_title:'Working date & data', set_clock_sub:'Every dashboard, calendar, pooja/event status and monthly report is calculated against this date. Move it to see how records track over time.', set_clock_apply:'Apply working date', set_clock_reset:'Reset to seed date', set_clock_note:'A custom working date is active and is remembered across reloads.', set_clock_bad:'Pick a valid date.', set_clock_done:'Working date set to', set_reset_confirm:'Reload and reset all demo data?', set_saved:'Temple information saved.', teams_moved:'Staff & volunteer teams are now the Management module', teams_moved_sub:'Volunteer teams, lead assignment, volunteering schedules, attendance and badges all live in Management Apps.', teams_open:'Open Management Apps', lang_switched:'Language switched to'
    },

    hi: {
      add:'जोड़ें', edit:'संपादित करें', delete:'हटाएँ', save:'सहेजें', cancel:'रद्द करें', close:'बंद करें',
      open:'खोलें', view:'देखें', back:'वापस', remove:'निकालें', confirm:'पुष्टि करें', search:'खोजें',
      export:'निर्यात', print:'प्रिंट', preview:'पूर्वावलोकन', reopen:'फिर से खोलें', yes:'हाँ', no:'नहीं',
      active:'सक्रिय', inactive:'निष्क्रिय', status:'स्थिति', name:'नाम', mobile:'मोबाइल',
      city:'शहर', state:'राज्य', role:'भूमिका', notes:'टिप्पणियाँ', date:'तारीख', time:'समय',
      venue:'स्थान', actions:'क्रियाएँ', all:'सभी', none:'कोई नहीं', today:'आज', upcoming:'आगामी',
      completed:'पूर्ण', pending:'लंबित',

      annc_kicker:'आज के मंदिर समाचार', annc_update:'सूचना', annc_updates:'सूचनाएँ',
      annc_today:'आज', annc_tomorrow:'कल', annc_in_days:'{n} दिन में',
      annc_view:'विवरण देखें', annc_continue:'डैशबोर्ड पर जाएँ',

      nav_yagna_signups:'🔥 महा यज्ञ पंजीकरण',

      nav_dhaja:'🚩 ध्वजा पूजा', cal_dhaja:'🚩 ध्वजा', rep_dhaja:'ध्वजा पूजा',
      dhaja_title:'ध्वजा पूजा', dhaja_subtitle:'सेवार्थी ध्वजा पूजा प्रायोजित करते हैं — हर प्रायोजन पर 80G रसीद',
      dhaja_sponsor_btn:'ध्वजा प्रायोजित करें', dhaja_register:'प्रायोजन रजिस्टर',
      dhaja_campaigns:'अभियान', dhaja_campaigns_meta:'फरवरी + विशेष दिन',
      dhaja_sponsored:'प्रायोजित', dhaja_sponsored_meta:'बुक की गई ध्वजा पूजाएँ',
      dhaja_raised:'योगदान', dhaja_raised_meta:'कुल प्राप्त',
      dhaja_remaining:'शेष (108)', dhaja_remaining_meta:'108 तक पहुँचने के लिए',
      dhaja_seq:'क्रम', dhaja_receipt:'रसीद', dhaja_all:'सभी', dhaja_left:'शेष',
      dhaja_open:'खुला', dhaja_from:'से', dhaja_received:'प्राप्त', dhaja_day:'दिन',
      dhaja_special_days:'विशेष-दिन ध्वजा', dhaja_open_sponsorship:'ध्वजा प्रायोजन खोलें',
      dhaja_empty:'अभी कोई ध्वजा अभियान नहीं। नीचे किसी विशेष दिन से खोलें, या “ध्वजा प्रायोजित करें” चुनें।',
      dhaja_none:'अभी कोई प्रायोजन नहीं।', dhaja_search:'प्रायोजक / रसीद खोजें…',
      dhaja_form_campaign:'अभियान / अवसर', dhaja_form_person:'सेवार्थी (भक्त)',
      dhaja_form_person_hint:'रजिस्टर से व्यक्ति चुनें, या नया भक्त जोड़ें।',
      dhaja_form_amount:'योगदान (₹)', dhaja_form_date:'रसीद तिथि',
      dhaja_form_scheduled:'ध्वजा तिथि (वैकल्पिक)', dhaja_form_notes:'टिप्पणी',
      dhaja_mark_done:'हो गया', dhaja_status_reserved:'आरक्षित', dhaja_status_sponsored:'प्रायोजित',
      dhaja_status_performed:'सम्पन्न', dhaja_status_cancelled:'रद्द',
      dhaja_campaign_full:'वह ध्वजा अभियान पूर्ण / बंद है।', dhaja_campaign_closed:'बंद',
      dhaja_no_open:'कोई खुला ध्वजा अभियान नहीं — पहले किसी विशेष दिन से खोलें।',
      dhaja_pick_campaign:'एक अभियान चुनें।', dhaja_bad_amount:'योगदान राशि दर्ज करें।',
      dhaja_pick_person:'सेवार्थी चुनें या जोड़ें।', dhaja_saved_local:'स्थानीय रूप से सहेजा — ऑनलाइन होने पर सिंक होगा।',
      dhaja_need_online:'विशेष-दिन अभियान खोलने के लिए ऑनलाइन हों।', dhaja_opened:'ध्वजा प्रायोजन खोला गया।',
      dhaja_cancel_title:'यह ध्वजा प्रायोजन रद्द करें?', dhaja_cancel_body:'संबंधित दान और उसकी रसीद रद्द हो जाएगी।',
      dhaja_new_campaign:'नया अभियान', dhaja_edit_campaign:'ध्वजा अभियान संपादित करें',
      dhaja_camp_created:'अभियान बना।', dhaja_camp_deleted:'अभियान हटाया गया।',
      dhaja_camp_need_name:'अभियान का नाम दर्ज करें।', dhaja_camp_delete_title:'अभियान हटाएँ?',
      dhaja_camp_delete_body:'यह ध्वजा अभियान हटाएँ?',
      dhaja_camp_has_sponsors:'इस अभियान में {n} प्रायोजन हैं। इसे हटाकर उनकी रसीदें रद्द करें?',
      dhaja_camp_general_keep:'सामान्य अभियान हटाया नहीं जा सकता।',
      dhaja_add_special_day:'विशेष दिन जोड़ें', dhaja_no_special:'अभी कोई विशेष दिन नहीं — ऊपर जोड़ें।',
      dhaja_no_annual_form:'विशेष दिन Events पेज से जोड़ें।',
      dhaja_general_all:'हर ध्वजा पूजा — सभी अवसर',
      dhaja_start_campaign:'अभियान शुरू करें', dhaja_tithi_ref:'इस वर्ष की मंदिर तिथियाँ',
      dhaja_tithi_hint:'केवल तारीख संदर्भ। “अभियान शुरू करें” उस दिन के लिए नया ध्वजा अभियान भर देता है — मंदिर कैलेंडर नहीं बदलता।',
      dhaja_add_tile_hint:'फरवरी महोत्सव, कोई विशेष दिन, या कोई भी अवसर', dhaja_camp_form_missing:'पेज रीलोड करके फिर से प्रयास करें।',

      temple_name:'श्री विहत मेलडी धाम',
      temple_loc:'साणंद, गुजरात',
      sub_tagline:'साणंद, गुजरात — केंद्रीय प्रबंधन मंच',
      sign_in:'🔐 साइन इन करें', sign_out:'साइन आउट', administrator:'प्रशासक',
      search_placeholder:'कुछ भी खोजें…', search_none:'कोई मेल नहीं। नाम, रसीद संख्या या अनुभाग आज़माएँ।', search_action:'त्वरित क्रिया', add_devotee:'श्रद्धालु दर्ज करें',

      nav_main:'मुख्य नेविगेशन', nav_ops:'मंच और संचालन', nav_grp_overview:'सारांश', nav_grp_seva:'सेवा एवं कार्यक्रम', nav_grp_people:'लोग एवं प्रशासन', nav_grp_resources:'दान एवं संसाधन', nav_grp_admin:'प्रशासन', rep_downloads:'डाउनलोड करने योग्य रजिस्टर', set_founder:'मंदिर संस्थापक / મંદિર સ્થાપક', set_head:'मंदिर प्रमुख / મંદિર પ્રમુખ', exp_word:'निर्यात',
      nav_dashboard:'🏠 डैशबोर्ड', nav_puja:'🪔 पूजा और सेवा', nav_donations:'💰 दान प्रबंधन',
      nav_devotees:'👥 श्रद्धालु पंजी', nav_management:'🗂️ प्रबंधन ऐप्स',
      nav_committees:'🏛️ समिति / समाज', nav_teams:'👷 स्टाफ एवं टीम', nav_events:'📅 कार्यक्रम / उत्सव',
      nav_invite:'🎴 संयुक्त निमंत्रण',
      dv_title:'श्रद्धालु 360°', dv_sub:'हर श्रद्धालु और मंदिर से जुड़ी उनकी हर जानकारी',
      dv_register:'श्रद्धालु पंजी', dv_add:'श्रद्धालु जोड़ें', dv_edit:'श्रद्धालु संपादित करें', dv_none:'कोई श्रद्धालु नहीं मिला।', dv_full_name:'पूरा नाम',
      dv_samaj:'समाज', dv_no_samaj:'कोई समाज नहीं',
      dv_category:'श्रेणी', dv_category_all:'सभी श्रेणियाँ', dv_committee_all:'सभी समितियाँ',
      dv_cat_normal:'सामान्य', dv_cat_vip:'वीआईपी', dv_cat_guest:'अतिथि', dv_cat_gurudev_bhuvaji:'गुरुदेव/भुवाजी',
      pj_inv_aud_category:'श्रेणी', pj_inv_aud_category_all:'सभी श्रेणियाँ',
      pj_inv_aud_cat_hint:'ऊपर दिए गए दर्शकों को एक श्रेणी तक सीमित करें — किसी समिति के साथ जोड़ें (जैसे "रबारी समाज समिति के वीआईपी सदस्य"), या समिति को खुला/सार्वजनिक छोड़कर केवल एक श्रेणी चुनें ताकि मेल खाने वाले हर भक्त को पूरे मंदिर में आमंत्रित किया जा सके।',
      dv_samaj_ph:'समुदाय लेबल, जैसे रबारी समाज',
      dv_committees_pick:'समितियाँ',
      dv_cmt_sync_fail:'कुछ समिति परिवर्तन सिंक नहीं हुए।',
      all_samaj:'सभी समाज / समुदाय',
      dv_committees:'समितियाँ', dv_teams:'टीमें', dv_visits:'स्थान पर पधरामणी', dv_joined:'जुड़े',
      dv_donated:'दान दिया', dv_total_received:'कुल प्राप्त', dv_total_pledged:'वचनबद्ध',
      dv_kpi_total:'पंजीकृत श्रद्धालु', dv_kpi_linked:'सक्रिय रूप से जुड़े',
      dv_kpi_linked_meta:'किसी समिति, टीम, सेवा, पधरामणी या दान में',
      dv_kpi_donated:'कुल प्राप्त (₹)', dv_kpi_upcoming:'आगामी सहभागिताएँ',
      dv_kpi_upcoming_meta:'आगामी सेवा, समन्वय, अतिथि व पधरामणी',
      dv_k_seva:'सेवार्थी', dv_k_coord:'समन्वयक', dv_k_vol:'स्वयंसेवक', dv_k_guest:'अतिथि',
      dv_roles:'भूमिकाएँ व सदस्यता', dv_no_roles:'अभी किसी समिति या टीम में नहीं।',
      dv_no_upcoming:'कुछ आगामी नहीं', dv_history:'पूर्ण व इतिहास', dv_no_history:'अभी कोई पूर्ण गतिविधि नहीं',
      dv_ledger:'बही — पुराने पहले', dv_ledger_sub:'हर मंदिर सहभागिता का कालानुक्रमिक रिकॉर्ड',
      dv_print_ledger:'बही PDF प्रिंट करें', dv_no_ledger:'अभी कोई जुड़ी गतिविधि नहीं।',
      dv_col_devotee:'श्रद्धालु', dv_col_type:'प्रकार', dv_col_detail:'विवरण', dv_col_amount:'राशि (₹)',
      dv_col_pooja:'पूजा / सेवा', dv_col_sessions:'सत्र तिथि(याँ)',
      dv_as_sevarthi:'सेवार्थी के रूप में', dv_as_coord:'समन्वयक के रूप में', dv_as_guest:'अतिथि उपस्थिति',
      dv_sev_status:'सेवार्थी स्थिति', dv_guest_role:'अतिथि भूमिका',
      dv_visits_sec:'पधरामणी', dv_pledged_don:'वचनबद्ध दान', dv_received_don:'प्राप्त दान',
      dv_events_led:'संचालित कार्यक्रम', dv_cmte_lead:'समिति प्रमुख', dv_team_lead:'टीम प्रमुख',
      dv_leader:'प्रमुख', dv_lead:'प्रमुख',
      dv_no_don_match:'इस मोबाइल नंबर से कोई दान रिकॉर्ड नहीं मिला।',
      dv_no_don_mobile:'दान रिकॉर्ड जोड़ने हेतु मोबाइल नंबर जोड़ें।',
      dv_advice:'श्रद्धालु एक साझा व्यक्ति रिकॉर्ड है — वही रिकॉर्ड हर जगह पुनः उपयोग होता है (समिति सदस्य, टीम स्वयंसेवक, सेवार्थी, समन्वयक, अतिथि, दाता)। यहाँ किए बदलाव हर जगह दिखते हैं।',
      dv_need_name:'नाम आवश्यक है।', dv_need_mobile:'मोबाइल 10 अंकों का होना चाहिए।',
      dv_export_title:'श्रद्धालु 360° — पंजी',
      dv_export_sub:'सभी श्रद्धालु — जुड़ी समितियाँ, टीमें, सेवा, पधरामणी व दान सहित',
      nav_inventory:'📦 इन्वेंट्री प्रबंधन', nav_expenses:'💸 खर्च प्रबंधन', nav_visits:'🙏 बाप्पा / भुवाजी यात्रा',
      nav_calendar:'🗓️ एकीकृत कैलेंडर', nav_reports:'📊 रिपोर्ट्स', nav_settings:'⚙️ सेटिंग्स',
      nav_admin:'🛡️ खाते एवं पहुँच',

      banner_headline:'જય શ્રી વિહત મેલડી ધામ',
      banner_tagline:'માતાજીની કૃપા, ભક્તોની શ્રદ્ધા',
      banner_khamma:'ખમ્મા માડી, ખમ્મા 🙏',
      welcome_back:'वापसी पर स्वागत है',
      kpi_seva:'आज की सेवा बुकिंग', kpi_donations:'आज का कुल दान',
      kpi_devotees:'पंजीकृत श्रद्धालु', kpi_visits:'आज के मंदिर दर्शन',
      quick_actions:'त्वरित संचालन कार्य', modules_launcher:'प्रबंधन मॉड्यूल लॉन्चर',
      todays_overview:'आज का विवरण', recent_activity:'हाल की गतिविधि',

      action_book_seva:'सेवा बुक करें', action_record_donation:'दान रसीद काटें',
      action_add_devotee:'श्रद्धालु जोड़ें', action_add_expense:'खर्च दर्ज करें',
      action_qr_badge:'क्यूआर बैज', action_events:'कार्यक्रम', action_inventory:'सामग्री सूची',
      action_reports:'रिपोर्ट्स',

      mob_home:'होम', mob_seva:'सेवा', mob_donations:'दान', mob_devotees:'श्रद्धालु',
      mob_management:'टीम', mob_more:'अन्य',

      /* वार्षिक मंदिर प्रसंग */
      ann_title:'वार्षिक मंदिर आयोजन', ann_title_gu:'મંદિરના વાર્ષિક પ્રસંગો', ann_year:'वर्ष', ann_add:'आयोजन जोड़ें',
      ann_none:'कोई वार्षिक आयोजन नहीं।', ann_disabled:'निष्क्रिय', ann_scheduled:'निर्धारित', ann_disabled_t:'आयोजन निष्क्रिय किया।', ann_enabled:'आयोजन सक्रिय किया।',
      ann_src_pinned:'निर्धारित', ann_src_fixed:'स्थिर तिथि', ann_src_calc:'गणना की गई', ann_fixed:'स्थिर तिथि',
      ann_verify:'गणना की गई — मंदिर पंचांग से मिलान करें और आवश्यकता हो तो निर्धारित करें।',
      ann_no_date:'इस वर्ष के लिए गणना नहीं हो सकी — सही तिथि निर्धारित करें।', ann_not_set:'तिथि तय नहीं — निर्धारित करें',
      ann_make_pooja:'सेवा/पूजा बनाएँ', ann_make_invite:'निमंत्रण बनाएँ', ann_pin:'तिथि निर्धारित करें',
      ann_disable:'निष्क्रिय करें', ann_enable:'सक्रिय करें', ann_from:'वार्षिक आयोजन से बनाया', ann_created:'सेवा/पूजा बन गई',
      ann_pin_help:'इस वर्ष की सही ग्रेगोरियन तिथि मंदिर पंचांग से भरें। यह केवल इसी वर्ष की गणना पर लागू होगी।',
      ann_unpin:'निर्धारण हटाएँ', ann_bad_date:'सही तिथि चुनें।', ann_unpinned:'निर्धारण हटाया।', ann_pinned:'तिथि निर्धारित।',
      ann_name_en:'नाम (अंग्रेज़ी) *', ann_name_gu:'नाम (ગુજરાती)', ann_act_en:'गतिविधि (अंग्रेज़ी)', ann_act_gu:'गतिविधि (ગુજરાती)',
      ann_type:'प्रकार', ann_type_tithi:'तिथि (हिंदू पंचांग)', ann_type_fixed:'स्थिर ग्रेगोरियन तिथि', ann_active:'सक्रिय',
      ann_masa:'गुजराती माह (मास)', ann_paksha:'पक्ष', ann_tithi:'तिथि (1–15)', ann_month:'माह (1–12)', ann_day:'दिन (1–31)',
      ann_notes:'टिप्पणियाँ', ann_need_name:'नाम आवश्यक है।', ann_title_annual_event:'वार्षिक मंदिर आयोजन',
      ann_once:'एक-बार का आयोजन — केवल नीचे दिए वर्ष में होता है, हर साल नहीं',
      ann_once_year:'वर्ष', ann_once_badge:'एक-बार', ann_once_hint:'एक-बार का आयोजन — अगले साल नहीं आएगा',
      ev_festival_title:'उत्सव कार्यक्रम एवं महोत्सव',
      ev_festival_sub:'स्थल, प्रभारी, बजट और अपेक्षित उपस्थिति वाले एक-बार के बहु-दिवसीय कार्यक्रम — ऊपर के वार्षिक तिथि कैलेंडर से अलग।',
      ev_festival_empty:'अभी कोई उत्सव कार्यक्रम नहीं। महोत्सव, डायरो या सेवा कार्यक्रम की योजना हेतु “आयोजन जोड़ें” का उपयोग करें।',
      ev_type_empty:'वैकल्पिक — उत्सव कार्यक्रमों को समूहबद्ध करने हेतु पुनः प्रयोज्य श्रेणियाँ (नवरात्रि, अन्नकूट, डायरो…) जोड़ें। तिथि कैलेंडर के लिए आवश्यक नहीं।',
      pj_title:'पूजा और सेवा', pj_my_title:'मेरी पूजाएँ',
      pj_sub_admin:'पूजा कार्यक्रम बनाएँ, सेवार्थी दर्ज करें, समन्वयक नियुक्त करें और निमंत्रण छापें',
      pj_sub_coord:'आपको सौंपी गई पूजा खोलें',
      pj_add:'पूजा जोड़ें', pj_export:'CSV निर्यात',
      pj_kpi_total:'कुल पूजाएँ', pj_kpi_upcoming:'आगामी', pj_kpi_sevarthis:'सेवार्थी',
      pj_kpi_types:'पूजा प्रकार',
      pj_open_ws:'पूजा वर्कस्पेस खोलें', pj_directory:'पूजा निर्देशिका',
      pj_col_id:'पूजा आईडी', pj_est_seva:'अनुमानित सेवा (₹)',
      pj_col_pooja:'पूजा', pj_actions:'क्रियाएँ', pj_sort_date:'तिथि से क्रमबद्ध करें (निकटतम पहले)',
      pj_people_registry:'अतिथि', pj_type_catalog:'अनुष्ठान प्रकार सूची',
      pj_schedule_btn:'पूजा / सेवा शेड्यूल करें', pj_scheduled:'शेड्यूल की गई पूजा एवं सेवा',
      pj_view_cards:'कार्ड', pj_view_table:'तालिका',
      pj_setup:'सेटअप — अनुष्ठान प्रकार सूची एवं लोग',
      pj_catalog_hint:'पुनः उपयोग योग्य अनुष्ठान परिभाषाएँ। पूजा शेड्यूल करते समय इनमें से एक चुनें।',
      pj_add_type_btn:'अनुष्ठान प्रकार जोड़ें', pj_guests_hint:'पुजारी एवं विशेष अतिथि जिन्हें किसी भी पूजा से जोड़ा जा सकता है।',
      pj_flow_1_t:'अनुष्ठान प्रकार सेट करें', pj_flow_1_d:'सूची में पुनः उपयोग योग्य टेम्पलेट — नाम, सामग्री, अवधि। कोई तिथि नहीं।',
      pj_flow_2_t:'पूजा / सेवा शेड्यूल करें', pj_flow_2_d:'प्रकार चुनें, तिथि, स्थान, सेवार्थी एवं अतिथि तय करें।',
      pj_flow_3_t:'पूजा खोलें', pj_flow_3_d:'सेवार्थी संभालें, निमंत्रण छापें, कैलेंडर देखें।',
      pj_tab_overview:'सारांश', pj_tab_sevarthi:'सेवार्थी', pj_tab_invitation:'निमंत्रण',
      pj_tab_calendar:'कैलेंडर', pj_tab_settings:'सेटिंग्स', pj_tab_activity:'गतिविधि',
      pj_sevarthi_records:'सेवार्थी रिकॉर्ड',
      pj_sevarthi_sub:'वे श्रद्धालु जिन्होंने इस पूजा की सेवा ली है',
      pj_add_sevarthi:'सेवार्थी जोड़ें', pj_add_guest:'अतिथि जोड़ें',
      pj_new_guest:'+ नया अतिथि जोड़ें',
      pj_session_schedule:'सत्र समय-सारणी', pj_manage_sessions:'सत्र प्रबंधित करें',
      pj_pooja_details:'पूजा विवरण', pj_guests_pandits:'अतिथि',
      pj_invitation_card:'निमंत्रण पत्र',
      pj_invitation_sub:'पूजा से स्वतः भरा हुआ। पाठ और शैली बदलें, फिर प्रिंट करें या PDF (A5) सहेजें।',
      pj_calendar:'पूजा कैलेंडर', pj_settings:'पूजा सेटिंग्स', pj_activity:'गतिविधि लॉग',
      pj_mark_completed:'✓ पूर्ण चिह्नित करें', pj_mark_extended:'विस्तारित चिह्नित करें',
      pj_cancel_pooja:'पूजा रद्द करें', pj_reopen_pooja:'पूजा फिर से खोलें',
      pj_schedule:'समय-सारणी', pj_next_session:'अगला सत्र', pj_days_to_go:'शेष दिन',
      pj_people:'लोग', pj_coordinator:'समन्वयक', pj_sevarthi:'सेवार्थी',
      pj_type:'प्रकार', pj_single_event:'एकल कार्यक्रम', pj_multi_session:'बहु-सत्र',
      pj_no_sevarthi:'अभी कोई सेवार्थी नहीं', pj_no_guests:'कोई अतिथि नहीं जोड़ा गया।',
      pj_today_is:'आज है',
      pj_status_auto_note:'जब तक आप यहाँ निर्धारित न करें, स्थिति सत्र तिथियों से स्वतः अद्यतन होती है।',

      pj_st_planned:'आगामी', pj_st_today:'आज हो रही है', pj_st_completed:'पूर्ण',
      pj_st_extended:'विस्तारित', pj_st_cancelled:'रद्द',
      civ_title:'संयुक्त निमंत्रण', civ_sub:'अब तक जोड़ी गई किसी भी पूजा को चुनें और सभी को एक साथ सूचीबद्ध करने वाला एक संयुक्त निमंत्रण कार्ड बनाएँ।',
      civ_pick_poojas:'पूजाएँ चुनें', civ_no_poojas:'अभी तक कोई पूजा नहीं जोड़ी गई।',
      civ_select_all:'सभी चुनें', civ_clear_all:'हटाएँ',
      civ_empty_preview:'संयुक्त कार्ड बनाने हेतु एक या अधिक पूजाएँ चुनें।',
      civ_default_headline:'आगामी पूजाएँ एवं सेवा',
      civ_need_pooja:'पहले कम से कम एक पूजा चुनें।', civ_no_date:'कोई तिथि तय नहीं',
      civ_pages_total:'पेज', civ_pages_each:'प्रत्येक',
      civ_show_time:'सत्र का समय दिखाएँ', civ_show_time_hint:'प्रति पेज अधिक पूजाएँ दिखाने के लिए बंद करें — हर पंक्ति में केवल दिन और तारीख रहेगी।',

      don_title:"दान", don_sub:"नकद एवं वस्तु दान, 80G रसीदें और धन्यवाद प्रमाणपत्र", don_record:"दान दर्ज करें", don_edit:"दान संपादित करें", don_kpi_cash:"इस माह नकद", don_kpi_kind:"इस माह वस्तु दान", don_kpi_kind_meta:"प्राप्त अनुमानित मूल्य", don_kpi_donors:"पंजीकृत दानदाता", don_kpi_donors_meta:"व्यक्ति, कंपनी एवं ट्रस्ट", don_kpi_pledged:"वचनबद्ध", don_kpi_pledged_meta:"प्राप्ति शेष", don_register:"दान रजिस्टर", don_donor_registry:"दानदाता रजिस्टर", don_categories:"दान श्रेणियाँ", don_category:"श्रेणी", don_add_donor:"दानदाता जोड़ें", don_add_category:"श्रेणी जोड़ें", don_edit_category:"श्रेणी संपादित करें", don_edit_donor:"दानदाता संपादित करें", don_receipt_no:"रसीद क्रमांक", don_donor:"दानदाता", don_given:"दान", don_value:"मूल्य", don_donor_type:"प्रकार", don_lifetime:"कुल", don_received:"प्राप्त", don_pledged:"वचनबद्ध", don_receipt:"रसीद", don_certificate:"प्रमाणपत्र", don_est_value:"अनु. मूल्य", don_none:"कोई दान नहीं मिला।", don_no_donors:"कोई दानदाता नहीं।", don_records:"रिकॉर्ड", don_unused:"अभी उपयोग नहीं", don_kind:"वस्तु", don_cash:"नकद", don_select_donor:"दानदाता चुनें", don_no_pan:"PAN उपलब्ध नहीं", don_history:"दान इतिहास", don_contact_person:"संपर्क व्यक्ति", don_committee:"समिति / समाज", don_save_receipt:"सहेजें व रसीद जारी करें", don_saved:"दान दर्ज हुआ", don_updated:"दान अद्यतन हुआ", don_deleted:"दान हटाया गया", don_delete_title:"दान हटाएँ", don_delete_body:"इसका रिकॉर्ड हटाएँ", don_pick_donor:"कृपया दानदाता चुनें।", don_pick_category:"कृपया श्रेणी चुनें।", don_need_item:"दान की गई वस्तु बताएँ।", don_need_value:"अनुमानित मूल्य दर्ज करें।", don_need_amount:"दान राशि दर्ज करें।", don_donor_exists:"इस मोबाइल से दानदाता पहले से मौजूद है", don_edit_instead:"उस रिकॉर्ड को संपादित करें।", don_need_name:"दाता का नाम आवश्यक है।", don_need_org:"संस्था का नाम आवश्यक है।", don_need_mobile:"मोबाइल 10 अंकों का हो।", don_bad_pan:"PAN प्रारूप गलत है (ABCDE1234F)।", don_donor_added:"दानदाता जोड़ा गया", don_donor_updated:"दानदाता अद्यतन", don_donor_deleted:"दानदाता हटाया गया", don_delete_donor:"दानदाता हटाएँ", don_delete_donor_body:"दानदाता हटाएँ", don_donor_in_use:"{n} दान इस दानदाता से जुड़े हैं - हटाया नहीं जा सकता।", don_need_cat_name:"श्रेणी नाम आवश्यक है।", don_cat_exists:"यह श्रेणी नाम पहले से है।", don_cat_added:"श्रेणी जोड़ी गई", don_cat_updated:"श्रेणी अद्यतन", don_cat_deleted:"श्रेणी हटाई गई", don_delete_category:"श्रेणी हटाएँ", don_delete_cat_body:"श्रेणी हटाएँ", don_cat_in_use:"{n} दान इस श्रेणी में हैं।", don_receipt_title:"आधिकारिक मंदिर रसीद (80G)", don_cert_title:"धन्यवाद प्रमाणपत्र", call:"कॉल", cmt_title:"समिति / समाज", cmt_my_title:"मेरी समितियाँ", cmt_all:"सभी समितियाँ", cmt_sub_admin:"Committees for the temple construction - leaders, members, meetings and attendance", cmt_sub_lead:"Open a committee assigned to you", cmt_add:"समिति जोड़ें", cmt_create:"समिति बनाएँ", cmt_edit:"समिति संपादित करें", cmt_delete:"समिति हटाएँ", cmt_kpi_total:"समितियाँ", cmt_kpi_total_meta:"Across the platform", cmt_kpi_members:"सदस्य", cmt_kpi_members_meta:"Registered across committees", cmt_kpi_meetings:"इस माह बैठकें", cmt_kpi_attendance:"औसत उपस्थिति", cmt_kpi_attendance_meta:"This month", cmt_none:"No committee assigned", cmt_none_admin:"Create your first committee.", cmt_none_lead:"No committee has been assigned to you yet.", cmt_open_ws:"समिति वर्कस्पेस खोलें", cmt_leader:"नेता", cmt_members:"सदस्य", cmt_attendance:"उपस्थिति", cmt_next:"अगली", cmt_no_meeting:"No meeting scheduled", cmt_expected:"अपेक्षित", cmt_seats:"स्थान", cmt_active_members:"सक्रिय", cmt_tab_overview:"सारांश", cmt_tab_members:"सदस्य", cmt_tab_meetings:"बैठकें", cmt_tab_calendar:"कैलेंडर", cmt_tab_whatsapp:"व्हाट्सएप", cmt_tab_settings:"सेटिंग्स", cmt_tab_activity:"गतिविधि", cmt_add_member:"सदस्य जोड़ें", cmt_edit_member:"सदस्य संपादित करें", cmt_schedule:"बैठक निर्धारित करें", cmt_edit_meeting:"Edit Meeting", cmt_meeting:"बैठक", cmt_meetings_word:"बैठकें", cmt_meetings_sub:"Schedule meetings and mark attendance", cmt_upcoming_meetings:"Upcoming Meetings", cmt_completed_meetings:"Completed Meetings", cmt_no_upcoming:"No upcoming meetings.", cmt_no_completed:"No completed meetings yet.", cmt_no_meetings:"No meetings assigned.", cmt_no_meetings2:"No meetings scheduled yet.", cmt_no_members:"No members yet.", cmt_no_activity:"No activity.", cmt_no_drafts:"No drafts yet.", cmt_joined:"जुड़े", cmt_also_in:"इनमें भी", cmt_deactivate:"निष्क्रिय करें", cmt_activate:"सक्रिय करें", cmt_present:"उपस्थित", cmt_absent:"अनुपस्थित", cmt_not_marked:"चिह्नित नहीं", cmt_invited:"आमंत्रित", cmt_scheduled:"निर्धारित", cmt_running:"चल रही", cmt_done:"पूर्ण", cmt_agenda:"कार्यसूची", cmt_attendance_list:"उपस्थिति सूची", cmt_attendance_history:"उपस्थिति इतिहास", cmt_all_present:"सभी उपस्थित", cmt_all_absent:"सभी अनुपस्थित", cmt_complete:"बैठक पूर्ण करें", cmt_complete_note:"Once completed, attendance becomes read-only.", cmt_meeting_done:"Meeting completed.", cmt_locked:"This meeting is completed. Attendance is read-only.", cmt_locked_short:"Locked", cmt_calendar:"बैठक कैलेंडर", cmt_settings:"समिति सेटिंग्स", cmt_settings_admin:"Full settings including leader assignment", cmt_settings_lead:"Leaders can edit committee details. Leader assignment is admin-only.", cmt_activity_log:"गतिविधि लॉग", cmt_whatsapp:"व्हाट्सएप संचार", cmt_whatsapp_sub:"Group, broadcast and reusable draft messages", cmt_group:"व्हाट्सएप ग्रुप", cmt_group_name:"Group Name", cmt_group_link:"Group Invite Link", cmt_broadcast:"ब्रॉडकास्ट", cmt_broadcast_name:"Broadcast Name", cmt_broadcast_link:"Broadcast Link", cmt_open_group:"Open Group", cmt_open_broadcast:"Open Broadcast", cmt_drafts:"संदेश ड्राफ्ट", cmt_new_draft:"नया ड्राफ्ट", cmt_edit_draft:"Edit Draft", cmt_delete_draft:"Delete Draft", cmt_draft_deleted:"Draft deleted.", cmt_updated:"Updated", cmt_copy:"कॉपी", cmt_send:"भेजें", cmt_copied:"Copied.", cmt_copied_paste:"Message copied - paste it in WhatsApp.", cmt_sent:"Message sent", cmt_no_link:"No link saved yet.", cmt_name:"समिति नाम", cmt_samaj:"समाज", cmt_expected_size:"अपेक्षित आकार", cmt_colour:"रंग", cmt_purpose:"उद्देश्य", cmt_select_leader:"Select leader", cmt_access_denied:"Access denied.", cmt_admin_only:"Only an administrator can do this.", cmt_leader_access:"Committee Leader access. You can only open:", cmt_need_name:"Name is required.", cmt_need_leader:"Assign a leader.", cmt_need_purpose:"Purpose is required.", cmt_delete_body:"This deletes the committee, its members, meetings and attendance.", cmt_created:"Committee created", cmt_deleted:"deleted", cmt_updated_by:"Committee updated by", cmt_already_member:"is already on this committee.", cmt_existing_devotee:"Existing devotee", cmt_will_link:"will be linked, not duplicated.", cmt_need_member_name:"First and last name are required.", cmt_need_mobile:"Mobile must be 10 digits.", cmt_added_word:"added", cmt_removed:"removed", cmt_deactivate_body:"They stop appearing in new meetings but history is kept.", cmt_remove_member:"Remove Member", cmt_remove_body:"Removes the committee assignment and its attendance rows. The devotee record is kept.", cmt_no_active_members:"No active members yet.", cmt_need_meeting_title:"Meeting title is required.", cmt_need_datetime:"Date and time are required.", cmt_end_after_start:"End time must be after start time.", cmt_pick_members:"Invite at least one member.", cmt_meeting_updated:"Meeting updated.", cmt_meeting_scheduled:"Meeting scheduled", cmt_delete_meeting:"Delete Meeting", cmt_meeting_deleted:"Meeting deleted.", cmt_need_draft:"Title and message are required.", cmt_no_meeting_row:"No meetings.", ev_title:"मंदिर कार्यक्रम", ev_sub:"उत्सव, महोत्सव और सेवा कार्यक्रम", ev_add:"कार्यक्रम जोड़ें", ev_edit:"कार्यक्रम संपादित करें", ev_delete:"Delete Event", ev_deleted:"Event deleted.", ev_created:"Event created", ev_updated:"Event updated", ev_kpi_total:"कुल कार्यक्रम", ev_kpi_total_meta:"On the calendar", ev_kpi_upcoming:"आगामी", ev_kpi_upcoming_meta:"Still to come", ev_kpi_footfall:"अनुमानित उपस्थिति", ev_kpi_types:"कार्यक्रम प्रकार", ev_kpi_types_meta:"Master list", ev_open_ws:"कार्यक्रम खोलें", ev_type_catalog:"कार्यक्रम प्रकार सूची", ev_type:"प्रकार", ev_add_type:"Add Event Type", ev_edit_type:"Edit Event Type", ev_delete_type:"Delete Event Type", ev_type_exists:"That type already exists.", ev_type_in_use:"event(s) use this type.", ev_type_deleted:"Type deleted.", ev_records:"event(s)", ev_unused:"Not used yet", ev_days:"दिन", ev_day:"day", ev_incharge:"प्रभारी", ev_footfall:"उपस्थिति", ev_budget:"बजट", ev_estimate:"Estimate", ev_schedule:"समय-सारणी", ev_manage_days:"Manage Days", ev_notice:"सूचना / निमंत्रण", ev_no_date:"No date", ev_tab_overview:"सारांश", ev_tab_schedule:"समय-सारणी", ev_tab_settings:"सेटिंग्स", ev_tab_activity:"गतिविधि", ev_st_planning:"नियोजन", ev_st_confirmed:"पुष्ट", ev_st_ongoing:"चालू", ev_st_completed:"पूर्ण", ev_st_cancelled:"रद्द", ev_select_type:"Select type", ev_select_incharge:"Select in-charge", ev_need_name:"Event name is required.", ev_need_type:"Select an event type.", ev_need_day:"Add at least one day.", ev_end_after:"End time must be after start time.", ev_invite_line:"You are cordially invited to", vis_title:"बाप्पा / भुवाजी पधरामणी", vis_sub:"घर, दुकान और पारिवारिक समारोहों में पधरामणी — एस्कॉर्ट टीम के साथ", vis_add:"पधरामणी जोड़ें", vis_add_devotee:"नया भक्त जोड़ें", vis_pick_devotee:"भक्त चुनें", vis_not_in_register:"रजिस्टर में नहीं", vis_edit:"पधरामणी संपादित करें", vis_delete:"Delete Visit", vis_deleted:"Visit deleted.", vis_added:"Visit added.", vis_kpi_total:"कुल पधरामणी", vis_kpi_upcoming:"आगामी", vis_kpi_upcoming_meta:"Scheduled / confirmed", vis_kpi_pending:"स्वीकृति प्रतीक्षित", vis_kpi_pending_meta:"New requests", vis_kpi_teams:"एस्कॉर्ट टीमें", vis_kpi_teams_meta:"On the roster", vis_register:"पधरामणी रजिस्टर", vis_devotee:"श्रद्धालु", vis_purpose:"उद्देश्य", vis_address:"पता", vis_datetime:"तिथि व समय", vis_escort:"एस्कॉर्ट टीम", vis_none:"No visits match.", vis_escort_ph:"Team that carries the palki & manages the visit", vis_need_name:"Devotee name is required.", vis_need_date:"Date is required.", vis_explain:"पधरामणी वह है जब माताजी की मूर्ति या भुवाजी (मंदिर के माध्यम) को श्रद्धालु के घर, दुकान या पारिवारिक समारोह में आशीर्वाद हेतु ले जाया जाता है। एस्कॉर्ट टीम वह स्वयंसेवक समूह है जो पालकी उठाता है, आरती थाली व भीड़ संभालता है, मूर्ति की सुरक्षा और वापसी यात्रा का प्रबंध करता है।", vis_p_home_inauguration:"नया घर / वास्तु", vis_p_shop_opening:"दुकान उद्घाटन", vis_p_wedding_blessing:"विवाह आशीर्वाद", vis_p_health_blessing:"स्वास्थ्य / आरोग्य", vis_p_business_puja:"व्यवसाय / फैक्ट्री पूजा", vis_p_festival_padhramani:"उत्सव पधरामणी", vis_p_other:"अन्य", vis_s_requested:"अनुरोधित", vis_s_scheduled:"निर्धारित", vis_s_confirmed:"पुष्ट", vis_s_completed:"पूर्ण", vis_s_cancelled:"रद्द", cal_title:"एकीकृत मंदिर कैलेंडर", cal_sub:"पूजा, समिति बैठकें, कार्यक्रम, वचनबद्ध दान और पधरामणी — एक ही स्थान पर", cal_sub_public:"पूरे मंदिर की पूजाएँ, कार्यक्रम और वार्षिक तिथियाँ", cal_next:"अगला", cal_up_next:"आगे", cal_agenda:"इस महीने", cal_item:"मद", cal_type:"प्रकार", cal_nothing:"इस माह कुछ भी निर्धारित नहीं।", cal_poojas:"पूजा", cal_meetings:"बैठकें", cal_events:"कार्यक्रम", cal_annual:"वार्षिक", cal_donations:"वचन", cal_visits:"पधरामणी", cal_pledge:"वचनबद्ध दान", cal_mon:"सोम", cal_tue:"मंगल", cal_wed:"बुध", cal_thu:"गुरु", cal_fri:"शुक्र", cal_sat:"शनि", cal_sun:"रवि", cal_more:"और", mg_lead:"प्रबंधन नेता", mg_volunteer:"स्वयंसेवक", mg_id:"आईडी", pj_inv_royal:"रॉयल (औपचारिक)", pj_inv_cream:"क्रीम (सादा)", pj_inv_festival:"उत्सव", pj_inv_lang_app:"ऐप जैसी", pj_inv_template:"टेम्पलेट", pj_inv_language:"कार्ड भाषा", pj_inv_accent:"एक्सेंट रंग", pj_inv_headline:"शीर्षक", pj_inv_line:"आमंत्रण पंक्ति", pj_inv_blessing:"समापन आशीर्वाद", pj_inv_show_schedule:"पूरा सत्र कार्यक्रम दिखाएँ", pj_inv_show_sevarthi:"सेवार्थी नाम दिखाएँ", pj_inv_show_guests:"अतिथि दिखाएँ", pj_inv_save:"कार्ड सहेजें", pj_inv_print:"प्रिंट / PDF", pj_inv_audience:"आमंत्रण किसे", pj_inv_aud_open:"खुला / सार्वजनिक आमंत्रण (नाम नहीं)", pj_inv_aud_grp:"प्रत्येक समिति सदस्य हेतु एक कार्ड", pj_inv_aud_hint:"किसी समाज / समिति को चुनें — हर सदस्य हेतु नाम, शहर, राज्य सहित व्यक्तिगत कार्ड बनेगा, PDF में एक-एक पृष्ठ।", pj_inv_aud_preview:"पूर्वावलोकन 1 / ", pj_inv_aud_pdf:"प्रिंट / PDF सभी बनाता है", pj_inv_aud_onepage:"प्रति पृष्ठ एक आमंत्रण", pj_inv_download:"सभी एक PDF में", pj_inv_print_only:"प्रिंट", pj_inv_dl_wait:"बन रहा है…", pj_inv_dl_prog:"रेंडर हो रहा है", pj_inv_dl_ok:"आमंत्रण पृष्ठ PDF में सहेजे गए।", pj_inv_dl_offline:"PDF इंजन उपलब्ध नहीं — प्रिंट व्यू खोला जा रहा है।", pj_inv_dl_fail:"PDF नहीं बना — प्रिंट व्यू खोला जा रहा है।", pj_inv_zip:"ZIP डाउनलोड (अलग-अलग)", pj_inv_zip_prog:"पैक हो रहा है", pj_inv_zip_ok:"आमंत्रण PDF ZIP में सहेजे गए।", pj_inv_zip_fail:"ZIP नहीं बना — प्रिंट व्यू खोला जा रहा है।", pj_inv_sub2:"पूजा से स्वतः भरा हुआ। पाठ, रंग और भाषा बदलें, फिर प्रिंट करें या PDF (A5) सहेजें।", pj_edit_pooja:'पूजा संपादित करें', pj_all_poojas:'सभी पूजाएँ', pj_sessions_word:'सत्र', dash_kpi_pooja:'आज की पूजाएँ', dash_kpi_don:'इस माह दान', dash_kpi_accounts:'अधिकृत खाते', dash_kpi_accounts_meta:'प्लेटफ़ॉर्म पहुँच सहित', dash_kpi_month:'इस माह', dash_glance:'आपके मंदिर की एक झलक',
      guide_title:'नए हैं? यह प्लेटफ़ॉर्म कैसे काम करता है', guide_reopen:'गाइड', guide_hide:'समझ गए — छिपाएँ',
      guide_lead:'पूरे मंदिर के लिए एक ही प्लेटफ़ॉर्म। साइडबार से कोई भाग चुनें, या नीचे दिए शॉर्टकट का उपयोग करें। हर सूची में ऊपर दाईं ओर “जोड़ें” बटन है, और हर रिकॉर्ड टैब वाले वर्कस्पेस में खुलता है।',
      guide_modules:'हर भाग किसलिए है', guide_tasks:'सामान्य काम — कहाँ जाएँ', guide_glossary:'यहाँ प्रयुक्त शब्द',
      guide_m_puja:'अनुष्ठान एवं सेवा शेड्यूल करें, सेवार्थी दर्ज करें, निमंत्रण छापें',
      guide_m_events:'त्योहार योजना — नवरात्रि, अन्नकूट, पाटोत्सव',
      guide_m_visits:'मूर्ति / भुवाजी को घर या दुकान पर ले जाएँ, एस्कॉर्ट टीम के साथ',
      guide_m_devotees:'दान, पूजा एवं समितियों में प्रयुक्त मुख्य पंजी',
      guide_m_cmt:'निर्माण शासन निकाय — सदस्य, बैठकें, उपस्थिति',
      guide_m_mg:'स्वयंसेवक टीमें — प्रसाद, पार्किंग, सजावट — रोस्टर एवं बैज',
      guide_m_don:'नकद एवं वस्तु दान, 80G रसीदें एवं प्रमाणपत्र',
      guide_m_exp:'वाउचर के विरुद्ध मंदिर व्यय दर्ज करें',
      guide_m_inv:'सामग्री, प्रसाद एवं संपत्ति, कम-स्टॉक अलर्ट के साथ',
      guide_m_cal:'हर भाग की हर तिथि वाली वस्तु एक ग्रिड पर',
      guide_m_rep:'लाइव मासिक आँकड़े + डाउनलोड योग्य पंजी (CSV / Excel / PDF)',
      guide_m_acc:'किसके पास लॉगिन है और कौन क्या खोल सकता है; ऑडिट ट्रेल',
      guide_m_set:'मंदिर पहचान, भाषा, और रिपोर्ट चलाने वाली कार्य तिथि',
      guide_t_don:'दान दर्ज करें एवं 80G रसीद छापें', guide_t_pooja:'पूजा या त्योहार सेवा शेड्यूल करें',
      guide_t_fest:'त्योहार योजना बनाएँ (नवरात्रि, अन्नकूट…)', guide_t_visit:'बप्पा / भुवाजी को घर या दुकान भेजें',
      guide_t_team:'स्वयंसेवक टीम शुरू करें (पार्किंग, प्रसाद…)', guide_t_login:'किसी को लॉगिन एक्सेस दें',
      guide_t_date:'कार्य तिथि या मंदिर विवरण बदलें',
      guide_g_sevarthi:'वह भक्त परिवार जो पूजा को सेवा रूप में प्रायोजित एवं संपन्न करता है।',
      guide_g_padh_k:'पधरामणी / भुवाजी भेंट', guide_g_padh:'माँ की मूर्ति या भुवाजी को भक्त के घर या दुकान पर आशीर्वाद हेतु ले जाना।',
      guide_g_cvm_k:'समिति बनाम प्रबंधन', guide_g_cvm:'समिति = निर्माण शासन निकाय। प्रबंधन = संचालन स्वयंसेवक टीमें।',
      guide_g_date_k:'कार्य तिथि', guide_g_date:'वह "आज" जिसके सापेक्ष हर डैशबोर्ड, रिपोर्ट एवं स्थिति मापी जाती है — सेटिंग्स में तय करें।',
      guide_g_scope_k:'"के रूप में देखें" (शीर्ष पट्टी)', guide_g_scope:'सीमित लॉगिन को दिखने वाला ऐप पूर्वावलोकन करें। कभी भी व्यवस्थापक पर वापस जाएँ।', dash_attention:'ध्यान देने योग्य', dash_today_temple:'आज पूरे मंदिर में', dash_today_area:'आज आपके क्षेत्र में', dash_today:'आज', dash_quiet:'शांत दिन — कुछ भी निर्धारित नहीं।', dash_your_area:'आपका क्षेत्र', dash_no_assign:'आपको अभी कुछ सौंपा नहीं गया।', dash_on_file:'रिकॉर्ड में', dash_items:'वस्तुएँ', dash_vouchers:'वाउचर', dash_a_pledged:'दान वचन वसूली की प्रतीक्षा में', dash_a_visits:'भुवाजी भेंट अनुरोध स्वीकृति हेतु', dash_a_sevarthi:'बिना सेवार्थी वाली पूजाएँ', dash_a_stock:'कम या समाप्त स्टॉक वस्तुएँ', dash_a_attend:'कम बैठक उपस्थिति वाली समितियाँ', nav_puja_s:'पूजा एवं सेवा', nav_management_s:'प्रबंधन ऐप्स', nav_devotees_s:'भक्त', nav_inventory_s:'भंडार', nav_expenses_s:'व्यय', role_superadmin:'सुपर एडमिन', role_admin:'एडमिन', role_management_lead:'प्रबंधन प्रमुख', role_pooja_coordinator:'पूजा समन्वयक', role_committee_leader:'समिति नेता', role_event_incharge:'कार्यक्रम प्रभारी', role_accountant:'लेखाकार', acc_title:'खाते एवं पहुँच', acc_sub:'हर अधिकृत खाता, वह क्या खोल सकता है, और एक सजीव ऑडिट ट्रेल', acc_kpi_total:'अधिकृत खाते', acc_kpi_total_meta:'सभी भूमिकाओं में', acc_kpi_admin:'सुपर एडमिन', acc_kpi_admin_meta:'पूर्ण प्लेटफ़ॉर्म पहुँच', acc_kpi_leaders:'नेता एवं समन्वयक', acc_kpi_leaders_meta:'अपने क्षेत्र तक सीमित', acc_kpi_roles:'पहुँच भूमिकाएँ', acc_kpi_roles_meta:'परिभाषित भूमिका प्रकार', acc_by_role:'भूमिका अनुसार पहुँच', acc_can_open:'खोल सकते हैं', acc_everything:'सब कुछ', acc_accounts:'खाते', acc_account_ct:'खाता', acc_roles:'भूमिकाएँ', acc_signin:'इस रूप में साइन इन करें', acc_audit:'ऑडिट ट्रेल', acc_audit_meta:'सजीव, हर मॉड्यूल से संकलित', acc_module:'मॉड्यूल', acc_action:'क्रिया', acc_when:'कब', acc_ref_title:'भूमिका एवं पहुँच संदर्भ', acc_ref_sub:'नियत भूमिका मॉडल। केवल सुपर एडमिन और एडमिन को दिखता है।', acc_ref_role:'भूमिका', acc_ref_open:'खोल सकने वाले पृष्ठ', acc_ref_dash:'दिखने वाला डैशबोर्ड', acc_ref_cal:'कैलेंडर में', acc_ref_pages:'पृष्ठ', rep_title:'रिपोर्ट एवं विश्लेषण', rep_sub:'चालू माह हेतु हर मॉड्यूल से सजीव आँकड़े', rep_export_all:'गतिविधि लॉग निर्यात', rep_don:'दान (नकद, माह)', rep_donkind:'वस्तु मूल्य (माह)', rep_exp:'व्यय (कुल)', rep_dev:'पंजीकृत भक्त', rep_pooja:'पूजाएँ', rep_cmt:'समिति उपस्थिति', rep_ev:'कार्यक्रम', rep_vis:'भुवाजी भेंट', set_title:'प्लेटफ़ॉर्म सेटिंग्स', set_sub:'मंदिर पहचान, भाषा और डेमो डेटा', set_identity:'मंदिर पहचान', set_name:'मंदिर का नाम', set_loc:'स्थान', set_email:'संपर्क ईमेल', set_phone:'संपर्क फ़ोन', set_platform:'प्लेटफ़ॉर्म', set_lang:'डिफ़ॉल्ट भाषा', set_clock:'डेमो घड़ी', set_accounts_hint:'प्लेटफ़ॉर्म पहुँच प्रबंधित करें', set_page:'पृष्ठ पर', set_reset:'नया लोड — सभी डेमो डेटा रीसेट करें', set_clock_title:'कार्य तिथि एवं डेटा', set_clock_sub:'हर डैशबोर्ड, कैलेंडर, पूजा/कार्यक्रम स्थिति और मासिक रिपोर्ट इसी तिथि के अनुसार गणना होती है। रिकॉर्ड को समय के साथ देखने हेतु इसे बदलें।', set_clock_apply:'कार्य तिथि लागू करें', set_clock_reset:'मूल तिथि पर रीसेट करें', set_clock_note:'एक कस्टम कार्य तिथि सक्रिय है और रीलोड पर याद रहती है।', set_clock_bad:'मान्य तिथि चुनें।', set_clock_done:'कार्य तिथि सेट की गई', set_reset_confirm:'पुनः लोड कर सभी डेमो डेटा रीसेट करें?', set_saved:'मंदिर जानकारी सहेजी गई।', teams_moved:'स्टाफ़ एवं स्वयंसेवक टीमें अब प्रबंधन मॉड्यूल में हैं', teams_moved_sub:'स्वयंसेवक टीमें, प्रमुख नियुक्ति, सेवा कार्यक्रम, उपस्थिति और बैज सभी प्रबंधन ऐप्स में हैं।', teams_open:'प्रबंधन ऐप्स खोलें', lang_switched:'भाषा बदली गई'
    },

    gu: {
      add:'ઉમેરો', edit:'સંપાદિત કરો', delete:'કાઢી નાખો', save:'સાચવો', cancel:'રદ કરો', close:'બંધ કરો',
      open:'ખોલો', view:'જુઓ', back:'પાછળ', remove:'દૂર કરો', confirm:'પુષ્ટિ કરો', search:'શોધો',
      export:'નિકાસ', print:'પ્રિન્ટ', preview:'પૂર્વાવલોકન', reopen:'ફરી ખોલો', yes:'હા', no:'ના',
      active:'સક્રિય', inactive:'નિષ્ક્રિય', status:'સ્થિતિ', name:'નામ', mobile:'મોબાઇલ',
      city:'શહેર', state:'રાજ્ય', role:'ભૂમિકા', notes:'નોંધ', date:'તારીખ', time:'સમય',
      venue:'સ્થળ', actions:'ક્રિયાઓ', all:'બધા', none:'કંઈ નહીં', today:'આજે', upcoming:'આગામી',
      completed:'પૂર્ણ', pending:'બાકી',

      annc_kicker:'આજના મંદિર સમાચાર', annc_update:'સૂચના', annc_updates:'સૂચનાઓ',
      annc_today:'આજે', annc_tomorrow:'આવતીકાલે', annc_in_days:'{n} દિવસમાં',
      annc_view:'વિગતો જુઓ', annc_continue:'ડેશબોર્ડ પર જાઓ',

      nav_yagna_signups:'🔥 મહા યજ્ઞ નોંધણી',

      nav_dhaja:'🚩 ધજા પૂજા', cal_dhaja:'🚩 ધજા', rep_dhaja:'ધજા પૂજા',
      dhaja_title:'ધજા પૂજા', dhaja_subtitle:'સેવાર્થી ધજા પૂજાનું પ્રાયોજન કરે છે — દરેક પ્રાયોજન પર 80G રસીદ',
      dhaja_sponsor_btn:'ધજા પ્રાયોજિત કરો', dhaja_register:'પ્રાયોજન રજિસ્ટર',
      dhaja_campaigns:'અભિયાન', dhaja_campaigns_meta:'ફેબ્રુઆરી + વિશેષ દિવસો',
      dhaja_sponsored:'પ્રાયોજિત', dhaja_sponsored_meta:'બુક કરેલી ધજા પૂજાઓ',
      dhaja_raised:'યોગદાન', dhaja_raised_meta:'કુલ પ્રાપ્ત',
      dhaja_remaining:'બાકી (108)', dhaja_remaining_meta:'108 સુધી પહોંચવા',
      dhaja_seq:'ક્રમ', dhaja_receipt:'રસીદ', dhaja_all:'બધા', dhaja_left:'બાકી',
      dhaja_open:'ખુલ્લું', dhaja_from:'થી', dhaja_received:'પ્રાપ્ત', dhaja_day:'દિવસ',
      dhaja_special_days:'વિશેષ-દિવસ ધજા', dhaja_open_sponsorship:'ધજા પ્રાયોજન ખોલો',
      dhaja_empty:'હજી કોઈ ધજા અભિયાન નથી. નીચે કોઈ વિશેષ દિવસથી ખોલો, અથવા “ધજા પ્રાયોજિત કરો” વાપરો.',
      dhaja_none:'હજી કોઈ પ્રાયોજન નથી.', dhaja_search:'પ્રાયોજક / રસીદ શોધો…',
      dhaja_form_campaign:'અભિયાન / પ્રસંગ', dhaja_form_person:'સેવાર્થી (ભક્ત)',
      dhaja_form_person_hint:'રજિસ્ટરમાંથી વ્યક્તિ પસંદ કરો, અથવા નવો ભક્ત ઉમેરો.',
      dhaja_form_amount:'યોગદાન (₹)', dhaja_form_date:'રસીદ તારીખ',
      dhaja_form_scheduled:'ધજા તારીખ (વૈકલ્પિક)', dhaja_form_notes:'નોંધ',
      dhaja_mark_done:'થઈ ગયું', dhaja_status_reserved:'આરક્ષિત', dhaja_status_sponsored:'પ્રાયોજિત',
      dhaja_status_performed:'સંપન્ન', dhaja_status_cancelled:'રદ',
      dhaja_campaign_full:'તે ધજા અભિયાન પૂર્ણ / બંધ છે.', dhaja_campaign_closed:'બંધ',
      dhaja_no_open:'કોઈ ખુલ્લું ધજા અભિયાન નથી — પહેલા કોઈ વિશેષ દિવસથી ખોલો.',
      dhaja_pick_campaign:'એક અભિયાન પસંદ કરો.', dhaja_bad_amount:'યોગદાન રકમ દાખલ કરો.',
      dhaja_pick_person:'સેવાર્થી પસંદ કરો અથવા ઉમેરો.', dhaja_saved_local:'સ્થાનિક રીતે સાચવ્યું — ઓનલાઇન થતાં સિંક થશે.',
      dhaja_need_online:'વિશેષ-દિવસ અભિયાન ખોલવા ઓનલાઇન રહો.', dhaja_opened:'ધજા પ્રાયોજન ખોલાયું.',
      dhaja_cancel_title:'આ ધજા પ્રાયોજન રદ કરવું?', dhaja_cancel_body:'સંબંધિત દાન અને તેની રસીદ રદ થશે.',
      dhaja_new_campaign:'નવું અભિયાન', dhaja_edit_campaign:'ધજા અભિયાન સંપાદિત કરો',
      dhaja_camp_created:'અભિયાન બન્યું.', dhaja_camp_deleted:'અભિયાન કાઢી નાખ્યું.',
      dhaja_camp_need_name:'અભિયાનનું નામ દાખલ કરો.', dhaja_camp_delete_title:'અભિયાન કાઢી નાખવું?',
      dhaja_camp_delete_body:'આ ધજા અભિયાન કાઢી નાખવું?',
      dhaja_camp_has_sponsors:'આ અભિયાનમાં {n} પ્રાયોજન છે. તેને કાઢી નાખીને તેમની રસીદો રદ કરવી?',
      dhaja_camp_general_keep:'સામાન્ય અભિયાન કાઢી શકાતું નથી.',
      dhaja_add_special_day:'વિશેષ દિવસ ઉમેરો', dhaja_no_special:'હજી કોઈ વિશેષ દિવસ નથી — ઉપર ઉમેરો.',
      dhaja_no_annual_form:'વિશેષ દિવસ Events પાનેથી ઉમેરો.',
      dhaja_general_all:'દરેક ધજા પૂજા — બધા પ્રસંગો',
      dhaja_start_campaign:'અભિયાન શરૂ કરો', dhaja_tithi_ref:'આ વર્ષની મંદિર તિથિઓ',
      dhaja_tithi_hint:'ફક્ત તારીખ સંદર્ભ. “અભિયાન શરૂ કરો” તે દિવસ માટે નવું ધજા અભિયાન ભરી આપે છે — મંદિર કેલેન્ડર બદલાતું નથી.',
      dhaja_add_tile_hint:'ફેબ્રુઆરી મહોત્સવ, કોઈ વિશેષ દિવસ, અથવા કોઈ પણ પ્રસંગ', dhaja_camp_form_missing:'પેજ રીલોડ કરીને ફરી પ્રયાસ કરો.',

      temple_name:'શ્રી વિહત મેલડી ધામ',
      temple_loc:'સાણંદ, ગુજરાત',
      sub_tagline:'સાણંદ, ગુજરાત — સેન્ટ્રલ મેનેજમેન્ટ પ્લેટફોર્મ',
      sign_in:'🔐 સાઇન ઇન કરો', sign_out:'સાઇન આઉટ', administrator:'એડમિનિસ્ટ્રેટર',
      search_placeholder:'કંઈ પણ શોધો…', search_none:'કોઈ મેળ નથી. નામ, રસીદ નંબર કે વિભાગ અજમાવો.', search_action:'ઝડપી ક્રિયા', add_devotee:'શ્રદ્ધાળુ નોંધો',

      nav_main:'મુખ્ય નેવિગેશન', nav_ops:'પ્લેટફોર્મ અને કામગીરી', nav_grp_overview:'ઝલક', nav_grp_seva:'સેવા અને કાર્યક્રમો', nav_grp_people:'લોકો અને વહીવટ', nav_grp_resources:'દાન અને સંસાધનો', nav_grp_admin:'વહીવટ', rep_downloads:'ડાઉનલોડ કરી શકાય તેવા રજિસ્ટર', set_founder:'મંદિર સ્થાપક', set_head:'મંદિર પ્રમુખ', exp_word:'નિકાસ',
      nav_dashboard:'🏠 ડેશબોર્ડ', nav_puja:'🪔 પૂજા અને સેવા', nav_donations:'💰 દાન મંડળ',
      nav_devotees:'👥 શ્રદ્ધાળુ રજીસ્ટર', nav_management:'🗂️ મેનેજમેન્ટ એપ્સ',
      nav_committees:'🏛️ સમિતિ / સમાજ', nav_teams:'👷 ટીમ અને સ્વયંસેવકો', nav_events:'📅 ધાર્મિક ઉત્સવો',
      nav_invite:'🎴 સંયુક્ત આમંત્રણ',
      dv_title:'શ્રદ્ધાળુ 360°', dv_sub:'દરેક શ્રદ્ધાળુ અને મંદિર સાથે જોડાયેલી તેમની દરેક વિગત',
      dv_register:'શ્રદ્ધાળુ રજીસ્ટર', dv_add:'શ્રદ્ધાળુ ઉમેરો', dv_edit:'શ્રદ્ધાળુ સંપાદિત કરો', dv_none:'કોઈ શ્રદ્ધાળુ મળ્યા નથી.', dv_full_name:'પૂરું નામ',
      dv_samaj:'સમાજ', dv_no_samaj:'કોઈ સમાજ નથી',
      dv_category:'શ્રેણી', dv_category_all:'બધી શ્રેણીઓ', dv_committee_all:'બધી સમિતિઓ',
      dv_cat_normal:'સામાન્ય', dv_cat_vip:'વીઆઈપી', dv_cat_guest:'મહેમાન', dv_cat_gurudev_bhuvaji:'ગુરુદેવ/ભુવાજી',
      pj_inv_aud_category:'શ્રેણી', pj_inv_aud_category_all:'બધી શ્રેણીઓ',
      pj_inv_aud_cat_hint:'ઉપરના પ્રેક્ષકોને એક શ્રેણી પૂરતા મર્યાદિત કરો — સમિતિ સાથે જોડો (દા.ત. "રબારી સમાજ સમિતિના વીઆઈપી સભ્યો"), અથવા સમિતિને ખુલ્લી/જાહેર રાખી ફક્ત શ્રેણી પસંદ કરો જેથી મેળ ખાતા દરેક ભક્તને આખા મંદિરમાંથી આમંત્રણ મળે.',
      dv_samaj_ph:'સમુદાય લેબલ, દા.ત. રબારી સમાજ',
      dv_committees_pick:'સમિતિઓ',
      dv_cmt_sync_fail:'કેટલાક સમિતિ ફેરફારો સિંક થયા નથી.',
      all_samaj:'બધા સમાજ / સમુદાય',
      dv_committees:'સમિતિઓ', dv_teams:'ટીમો', dv_visits:'સ્થળે પધરામણી', dv_joined:'જોડાયા',
      dv_donated:'દાન આપ્યું', dv_total_received:'કુલ મળેલ', dv_total_pledged:'વચનબદ્ધ',
      dv_kpi_total:'નોંધાયેલ શ્રદ્ધાળુ', dv_kpi_linked:'સક્રિય રીતે જોડાયેલા',
      dv_kpi_linked_meta:'કોઈ સમિતિ, ટીમ, સેવા, પધરામણી કે દાનમાં',
      dv_kpi_donated:'કુલ મળેલ (₹)', dv_kpi_upcoming:'આગામી સહભાગિતાઓ',
      dv_kpi_upcoming_meta:'આગામી સેવા, સંકલન, અતિથિ અને પધરામણી',
      dv_k_seva:'સેવાર્થી', dv_k_coord:'સંયોજક', dv_k_vol:'સ્વયંસેવક', dv_k_guest:'અતિથિ',
      dv_roles:'ભૂમિકાઓ અને સભ્યપદ', dv_no_roles:'હજી કોઈ સમિતિ કે ટીમમાં નથી.',
      dv_no_upcoming:'કંઈ આગામી નથી', dv_history:'પૂર્ણ અને ઇતિહાસ', dv_no_history:'હજી કોઈ પૂર્ણ પ્રવૃત્તિ નથી',
      dv_ledger:'ખાતાવહી — જૂનું પહેલાં', dv_ledger_sub:'દરેક મંદિર સહભાગિતાનો કાલક્રમિક રેકોર્ડ',
      dv_print_ledger:'ખાતાવહી PDF છાપો', dv_no_ledger:'હજી કોઈ જોડાયેલ પ્રવૃત્તિ નથી.',
      dv_col_devotee:'શ્રદ્ધાળુ', dv_col_type:'પ્રકાર', dv_col_detail:'વિગત', dv_col_amount:'રકમ (₹)',
      dv_col_pooja:'પૂજા / સેવા', dv_col_sessions:'સત્ર તારીખ(ઓ)',
      dv_as_sevarthi:'સેવાર્થી તરીકે', dv_as_coord:'સંયોજક તરીકે', dv_as_guest:'અતિથિ ઉપસ્થિતિ',
      dv_sev_status:'સેવાર્થી સ્થિતિ', dv_guest_role:'અતિથિ ભૂમિકા',
      dv_visits_sec:'પધરામણી', dv_pledged_don:'વચનબદ્ધ દાન', dv_received_don:'મળેલ દાન',
      dv_events_led:'સંચાલિત ઉત્સવો', dv_cmte_lead:'સમિતિ પ્રમુખ', dv_team_lead:'ટીમ પ્રમુખ',
      dv_leader:'પ્રમુખ', dv_lead:'પ્રમુખ',
      dv_no_don_match:'આ મોબાઇલ નંબર સાથે કોઈ દાન રેકોર્ડ મળ્યો નથી.',
      dv_no_don_mobile:'દાન રેકોર્ડ સાથે જોડવા મોબાઇલ નંબર ઉમેરો.',
      dv_advice:'શ્રદ્ધાળુ એ એક વહેંચાયેલ વ્યક્તિ રેકોર્ડ છે — એ જ રેકોર્ડ દરેક જગ્યાએ ફરી વપરાય છે (સમિતિ સભ્ય, ટીમ સ્વયંસેવક, સેવાર્થી, સંયોજક, અતિથિ, દાતા). અહીંના ફેરફાર બધે દેખાય છે.',
      dv_need_name:'નામ જરૂરી છે.', dv_need_mobile:'મોબાઇલ 10 અંકનો હોવો જોઈએ.',
      dv_export_title:'શ્રદ્ધાળુ 360° — રજીસ્ટર',
      dv_export_sub:'બધા શ્રદ્ધાળુ — જોડાયેલી સમિતિઓ, ટીમો, સેવા, પધરામણી અને દાન સહિત',
      nav_inventory:'📦 ઈન્વેન્ટરી સ્ટોક', nav_expenses:'💸 ખર્ચ હિસાબ', nav_visits:'🙏 બાપ્પા / ભુવાજી પધરામણી',
      nav_calendar:'🗓️ સંકલિત કેલેન્ડર', nav_reports:'📊 રિપોર્ટ્સ', nav_settings:'⚙️ સેટિંગ્સ',
      nav_admin:'🛡️ ખાતાં અને ઍક્સેસ',

      banner_headline:'જય શ્રી વિહત મેલડી ધામ',
      banner_tagline:'માતાજીની કૃપા, ભક્તોની શ્રદ્ધા',
      banner_khamma:'ખમ્મા માડી, ખમ્મા 🙏',
      welcome_back:'પુનઃ સ્વાગત છે',
      kpi_seva:'આજની સેવા બુકિંગ', kpi_donations:'આજનું કુલ દાન',
      kpi_devotees:'નોંધાયેલ શ્રદ્ધાળુઓ', kpi_visits:'આજના મંદિર દર્શન',
      quick_actions:'ઝડપી કાર્યો', modules_launcher:'મેનેજમેન્ટ મોડ્યુલ્સ લૉન્ચર',
      todays_overview:'આજની ઝલક', recent_activity:'તાજેતરની પ્રવૃત્તિ',

      action_book_seva:'સેવા બુક કરો', action_record_donation:'દાન પહોંચ નોંધો',
      action_add_devotee:'શ્રદ્ધાળુ ઉમેરો', action_add_expense:'ખર્ચ નોંધો',
      action_qr_badge:'QR બેજ', action_events:'ઉત્સવો', action_inventory:'સ્ટોક યાદી',
      action_reports:'રિપોર્ટ્સ',

      mob_home:'હોમ', mob_seva:'સેવા', mob_donations:'દાન', mob_devotees:'શ્રદ્ધાળુઓ',
      mob_management:'ટીમ', mob_more:'વધુ',

      /* વાર્ષિક મંદિર પ્રસંગો */
      ann_title:'મંદિરના વાર્ષિક પ્રસંગો', ann_title_gu:'મંદિરના વાર્ષિક પ્રસંગો', ann_year:'વર્ષ', ann_add:'પ્રસંગ ઉમેરો',
      ann_none:'કોઈ વાર્ષિક પ્રસંગ નથી.', ann_disabled:'નિષ્ક્રિય', ann_scheduled:'નિર્ધારિત', ann_disabled_t:'પ્રસંગ નિષ્ક્રિય કર્યો.', ann_enabled:'પ્રસંગ સક્રિય કર્યો.',
      ann_src_pinned:'નિશ્ચિત', ann_src_fixed:'સ્થિર તારીખ', ann_src_calc:'ગણતરી કરેલ', ann_fixed:'સ્થિર તારીખ',
      ann_verify:'ગણતરી કરેલ — મંદિરના પંચાંગ સાથે ખાતરી કરો અને જરૂર પડ્યે નિશ્ચિત કરો.',
      ann_no_date:'આ વર્ષ માટે ગણતરી થઈ શકી નથી — સાચી તારીખ નિશ્ચિત કરો.', ann_not_set:'તારીખ સેટ નથી — નિશ્ચિત કરો',
      ann_make_pooja:'સેવા/પૂજા બનાવો', ann_make_invite:'આમંત્રણ બનાવો', ann_pin:'તારીખ નિશ્ચિત કરો',
      ann_disable:'નિષ્ક્રિય કરો', ann_enable:'સક્રિય કરો', ann_from:'વાર્ષિક પ્રસંગમાંથી બનાવેલ', ann_created:'સેવા/પૂજા બની',
      ann_pin_help:'આ વર્ષની ચોક્કસ ગ્રેગોરિયન તારીખ મંદિરના પંચાંગ પ્રમાણે ભરો. તે ફક્ત આ વર્ષની ગણતરી પર લાગુ થશે.',
      ann_unpin:'નિશ્ચિતતા દૂર કરો', ann_bad_date:'સાચી તારીખ પસંદ કરો.', ann_unpinned:'નિશ્ચિતતા દૂર કરી.', ann_pinned:'તારીખ નિશ્ચિત કરી.',
      ann_name_en:'નામ (અંગ્રેજી) *', ann_name_gu:'નામ (ગુજરાતી)', ann_act_en:'પ્રવૃત્તિ (અંગ્રેજી)', ann_act_gu:'પ્રવૃત્તિ (ગુજરાતી)',
      ann_type:'પ્રકાર', ann_type_tithi:'તિથિ (હિન્દુ પંચાંગ)', ann_type_fixed:'સ્થિર ગ્રેગોરિયન તારીખ', ann_active:'સક્રિય',
      ann_masa:'ગુજરાતી માસ', ann_paksha:'પક્ષ', ann_tithi:'તિથિ (૧–૧૫)', ann_month:'માસ (૧–૧૨)', ann_day:'દિવસ (૧–૩૧)',
      ann_notes:'નોંધ', ann_need_name:'નામ જરૂરી છે.', ann_title_annual_event:'વાર્ષિક મંદિર પ્રસંગ',
      ann_once:'એક વખતનો પ્રસંગ — ફક્ત નીચેના વર્ષમાં જ થાય છે, દર વર્ષે નહીં',
      ann_once_year:'વર્ષ', ann_once_badge:'એક વખત', ann_once_hint:'એક વખતનો પ્રસંગ — આવતા વર્ષે નહીં આવે',
      ev_festival_title:'ઉત્સવ કાર્યક્રમો અને મહોત્સવ',
      ev_festival_sub:'સ્થળ, પ્રભારી, બજેટ અને અપેક્ષિત હાજરી સાથેના એક-વખતના બહુ-દિવસીય કાર્યક્રમો — ઉપરના વાર્ષિક તિથિ કેલેન્ડરથી અલગ.',
      ev_festival_empty:'હજુ કોઈ ઉત્સવ કાર્યક્રમ નથી. મહોત્સવ, ડાયરો કે સેવા કાર્યક્રમ આયોજવા “પ્રસંગ ઉમેરો” વાપરો.',
      ev_type_empty:'વૈકલ્પિક — ઉત્સવ કાર્યક્રમોને જૂથબદ્ધ કરવા પુનઃવપરાશ યોગ્ય શ્રેણીઓ (નવરાત્રી, અન્નકૂટ, ડાયરો…) ઉમેરો. તિથિ કેલેન્ડર માટે જરૂરી નથી.',
      pj_title:'પૂજા અને સેવા', pj_my_title:'મારી પૂજાઓ',
      pj_sub_admin:'પૂજા કાર્યક્રમ બનાવો, સેવાર્થી નોંધો, સંયોજક સોંપો અને આમંત્રણ છાપો',
      pj_sub_coord:'તમને સોંપેલી પૂજા ખોલો',
      pj_add:'પૂજા ઉમેરો', pj_export:'CSV નિકાસ',
      pj_kpi_total:'કુલ પૂજાઓ', pj_kpi_upcoming:'આગામી', pj_kpi_sevarthis:'સેવાર્થીઓ',
      pj_kpi_types:'પૂજા પ્રકાર',
      pj_open_ws:'પૂજા વર્કસ્પેસ ખોલો', pj_directory:'પૂજા ડિરેક્ટરી',
      pj_col_id:'પૂજા આઈડી', pj_est_seva:'અંદાજિત સેવા (₹)',
      pj_col_pooja:'પૂજા', pj_actions:'ક્રિયાઓ', pj_sort_date:'તારીખ પ્રમાણે ક્રમમાં ગોઠવો (નજીકની પહેલા)',
      pj_people_registry:'મહેમાનો', pj_type_catalog:'અનુષ્ઠાન પ્રકાર યાદી',
      pj_schedule_btn:'પૂજા / સેવા શેડ્યૂલ કરો', pj_scheduled:'શેડ્યૂલ કરેલી પૂજા અને સેવા',
      pj_view_cards:'કાર્ડ', pj_view_table:'કોષ્ટક',
      pj_setup:'સેટઅપ — અનુષ્ઠાન પ્રકાર યાદી અને લોકો',
      pj_catalog_hint:'ફરી વાપરી શકાય તેવી અનુષ્ઠાન વ્યાખ્યાઓ. પૂજા શેડ્યૂલ કરતી વખતે આમાંથી એક પસંદ કરો.',
      pj_add_type_btn:'અનુષ્ઠાન પ્રકાર ઉમેરો', pj_guests_hint:'પૂજારી અને ખાસ મહેમાનો જેમને કોઈ પણ પૂજા સાથે જોડી શકાય.',
      pj_flow_1_t:'અનુષ્ઠાન પ્રકાર સેટ કરો', pj_flow_1_d:'યાદીમાં ફરી વાપરી શકાય તેવા ટેમ્પલેટ — નામ, સામગ્રી, સમયગાળો. કોઈ તારીખ નહીં.',
      pj_flow_2_t:'પૂજા / સેવા શેડ્યૂલ કરો', pj_flow_2_d:'પ્રકાર પસંદ કરો, તારીખ, સ્થળ, સેવાર્થી અને મહેમાનો નક્કી કરો.',
      pj_flow_3_t:'પૂજા ખોલો', pj_flow_3_d:'સેવાર્થી સંભાળો, આમંત્રણ છાપો, કૅલેન્ડર જુઓ.',
      pj_tab_overview:'ઝલક', pj_tab_sevarthi:'સેવાર્થી', pj_tab_invitation:'આમંત્રણ',
      pj_tab_calendar:'કેલેન્ડર', pj_tab_settings:'સેટિંગ્સ', pj_tab_activity:'પ્રવૃત્તિ',
      pj_sevarthi_records:'સેવાર્થી રેકોર્ડ',
      pj_sevarthi_sub:'આ પૂજાની સેવા લેનાર શ્રદ્ધાળુઓ',
      pj_add_sevarthi:'સેવાર્થી ઉમેરો', pj_add_guest:'મહેમાન ઉમેરો',
      pj_new_guest:'+ નવો મહેમાન ઉમેરો',
      pj_session_schedule:'સત્ર સમયપત્રક', pj_manage_sessions:'સત્રો સંચાલિત કરો',
      pj_pooja_details:'પૂજા વિગતો', pj_guests_pandits:'મહેમાનો',
      pj_invitation_card:'આમંત્રણ કાર્ડ',
      pj_invitation_sub:'પૂજામાંથી આપોઆપ ભરાયેલું. લખાણ અને શૈલી બદલો, પછી પ્રિન્ટ કરો અથવા PDF (A5) સાચવો.',
      pj_calendar:'પૂજા કેલેન્ડર', pj_settings:'પૂજા સેટિંગ્સ', pj_activity:'પ્રવૃત્તિ લોગ',
      pj_mark_completed:'✓ પૂર્ણ તરીકે ચિહ્નિત કરો', pj_mark_extended:'વિસ્તૃત તરીકે ચિહ્નિત કરો',
      pj_cancel_pooja:'પૂજા રદ કરો', pj_reopen_pooja:'પૂજા ફરી ખોલો',
      pj_schedule:'સમયપત્રક', pj_next_session:'આગામી સત્ર', pj_days_to_go:'બાકી દિવસ',
      pj_people:'લોકો', pj_coordinator:'સંયોજક', pj_sevarthi:'સેવાર્થી',
      pj_type:'પ્રકાર', pj_single_event:'એકલ કાર્યક્રમ', pj_multi_session:'બહુ-સત્ર',
      pj_no_sevarthi:'હજી કોઈ સેવાર્થી નથી', pj_no_guests:'કોઈ મહેમાન ઉમેર્યા નથી.',
      pj_today_is:'આજે છે',
      pj_status_auto_note:'જ્યાં સુધી તમે અહીં સેટ ન કરો ત્યાં સુધી સ્થિતિ સત્ર તારીખો પરથી આપોઆપ અપડેટ થાય છે.',

      pj_st_planned:'આગામી', pj_st_today:'આજે થઈ રહી છે', pj_st_completed:'પૂર્ણ',
      pj_st_extended:'વિસ્તૃત', pj_st_cancelled:'રદ',
      civ_title:'સંયુક્ત આમંત્રણ', civ_sub:'અત્યાર સુધી ઉમેરાયેલ કોઈ પણ પૂજાઓ પસંદ કરો અને બધીને એકસાથે યાદી કરતું એક સંયુક્ત આમંત્રણ કાર્ડ બનાવો.',
      civ_pick_poojas:'પૂજાઓ પસંદ કરો', civ_no_poojas:'હજી કોઈ પૂજા ઉમેરાઈ નથી.',
      civ_select_all:'બધું પસંદ કરો', civ_clear_all:'સાફ કરો',
      civ_empty_preview:'સંયુક્ત કાર્ડ બનાવવા એક કે વધુ પૂજાઓ પસંદ કરો.',
      civ_default_headline:'આગામી પૂજાઓ અને સેવા',
      civ_need_pooja:'પહેલા ઓછામાં ઓછી એક પૂજા પસંદ કરો.', civ_no_date:'કોઈ તારીખ નક્કી નથી',
      civ_pages_total:'પાનાં', civ_pages_each:'દરેક',
      civ_show_time:'સત્રનો સમય બતાવો', civ_show_time_hint:'દરેક પેજ પર વધુ પૂજાઓ બતાવવા બંધ કરો — દરેક પંક્તિમાં ફક્ત દિવસ અને તારીખ રહેશે.',

      don_title:"દાન", don_sub:"રોકડ અને વસ્તુ દાન, 80G પહોંચ અને ધન્યવાદ પ્રમાણપત્ર", don_record:"દાન નોંધો", don_edit:"દાન સંપાદિત કરો", don_kpi_cash:"આ મહિને રોકડ", don_kpi_kind:"આ મહિને વસ્તુ દાન", don_kpi_kind_meta:"મળેલ અંદાજિત મૂલ્ય", don_kpi_donors:"નોંધાયેલ દાતાઓ", don_kpi_donors_meta:"વ્યક્તિ, કંપની અને ટ્રસ્ટ", don_kpi_pledged:"વચનબદ્ધ", don_kpi_pledged_meta:"મળવાનું બાકી", don_register:"દાન રજિસ્ટર", don_donor_registry:"દાતા રજિસ્ટર", don_categories:"દાન શ્રેણીઓ", don_category:"શ્રેણી", don_add_donor:"દાતા ઉમેરો", don_add_category:"શ્રેણી ઉમેરો", don_edit_category:"શ્રેણી સંપાદિત કરો", don_edit_donor:"દાતા સંપાદિત કરો", don_receipt_no:"પહોંચ નં", don_donor:"દાતા", don_given:"દાન", don_value:"મૂલ્ય", don_donor_type:"પ્રકાર", don_lifetime:"કુલ", don_received:"મળ્યું", don_pledged:"વચનબદ્ધ", don_receipt:"પહોંચ", don_certificate:"પ્રમાણપત્ર", don_est_value:"અંદાજિત મૂલ્ય", don_none:"કોઈ દાન મળ્યું નથી.", don_no_donors:"કોઈ દાતા નથી.", don_records:"રેકોર્ડ", don_unused:"હજી વપરાયું નથી", don_kind:"વસ્તુ", don_cash:"રોકડ", don_select_donor:"દાતા પસંદ કરો", don_no_pan:"PAN ઉપલબ્ધ નથી", don_history:"દાન ઇતિહાસ", don_contact_person:"સંપર્ક વ્યક્તિ", don_committee:"સમિતિ / સમાજ", don_save_receipt:"સાચવો અને પહોંચ આપો", don_saved:"દાન નોંધાયું", don_updated:"દાન અપડેટ થયું", don_deleted:"દાન કાઢી નાખ્યું", don_delete_title:"દાન કાઢી નાખો", don_delete_body:"આનો રેકોર્ડ કાઢી નાખો", don_pick_donor:"કૃપા કરી દાતા પસંદ કરો.", don_pick_category:"કૃપા કરી શ્રેણી પસંદ કરો.", don_need_item:"દાનમાં આપેલી વસ્તુ જણાવો.", don_need_value:"અંદાજિત મૂલ્ય દાખલ કરો.", don_need_amount:"દાનની રકમ દાખલ કરો.", don_donor_exists:"આ મોબાઇલ સાથે દાતા પહેલેથી છે", don_edit_instead:"એ રેકોર્ડ સંપાદિત કરો.", don_need_name:"દાતાનું નામ જરૂરી છે.", don_need_org:"સંસ્થાનું નામ જરૂરી છે.", don_need_mobile:"મોબાઇલ 10 અંકનો હોવો જોઈએ.", don_bad_pan:"PAN ફોર્મેટ ખોટું છે (ABCDE1234F).", don_donor_added:"દાતા ઉમેરાયો", don_donor_updated:"દાતા અપડેટ થયો", don_donor_deleted:"દાતા કાઢી નાખ્યો", don_delete_donor:"દાતા કાઢી નાખો", don_delete_donor_body:"દાતા કાઢી નાખો", don_donor_in_use:"{n} દાન આ દાતા સાથે જોડાયેલા છે - કાઢી શકાતું નથી.", don_need_cat_name:"શ્રેણી નામ જરૂરી છે.", don_cat_exists:"આ શ્રેણી નામ પહેલેથી છે.", don_cat_added:"શ્રેણી ઉમેરાઈ", don_cat_updated:"શ્રેણી અપડેટ થઈ", don_cat_deleted:"શ્રેણી કાઢી નાખી", don_delete_category:"શ્રેણી કાઢી નાખો", don_delete_cat_body:"શ્રેણી કાઢી નાખો", don_cat_in_use:"{n} દાન આ શ્રેણીમાં છે.", don_receipt_title:"સત્તાવાર મંદિર પહોંચ (80G)", don_cert_title:"ધન્યવાદ પ્રમાણપત્ર", call:"કૉલ", cmt_title:"સમિતિ / સમાજ", cmt_my_title:"મારી સમિતિઓ", cmt_all:"બધી સમિતિઓ", cmt_sub_admin:"Committees for the temple construction - leaders, members, meetings and attendance", cmt_sub_lead:"Open a committee assigned to you", cmt_add:"સમિતિ ઉમેરો", cmt_create:"સમિતિ બનાવો", cmt_edit:"સમિતિ સંપાદિત કરો", cmt_delete:"સમિતિ કાઢી નાખો", cmt_kpi_total:"સમિતિઓ", cmt_kpi_total_meta:"Across the platform", cmt_kpi_members:"સભ્યો", cmt_kpi_members_meta:"Registered across committees", cmt_kpi_meetings:"આ મહિને બેઠકો", cmt_kpi_attendance:"સરેરાશ હાજરી", cmt_kpi_attendance_meta:"This month", cmt_none:"No committee assigned", cmt_none_admin:"Create your first committee.", cmt_none_lead:"No committee has been assigned to you yet.", cmt_open_ws:"સમિતિ વર્કસ્પેસ ખોલો", cmt_leader:"આગેવાન", cmt_members:"સભ્યો", cmt_attendance:"હાજરી", cmt_next:"આગામી", cmt_no_meeting:"No meeting scheduled", cmt_expected:"અપેક્ષિત", cmt_seats:"બેઠકો", cmt_active_members:"સક્રિય", cmt_tab_overview:"ઝલક", cmt_tab_members:"સભ્યો", cmt_tab_meetings:"બેઠકો", cmt_tab_calendar:"કેલેન્ડર", cmt_tab_whatsapp:"વોટ્સએપ", cmt_tab_settings:"સેટિંગ્સ", cmt_tab_activity:"પ્રવૃત્તિ", cmt_add_member:"સભ્ય ઉમેરો", cmt_edit_member:"સભ્ય સંપાદિત કરો", cmt_schedule:"બેઠક ગોઠવો", cmt_edit_meeting:"Edit Meeting", cmt_meeting:"બેઠક", cmt_meetings_word:"બેઠકો", cmt_meetings_sub:"Schedule meetings and mark attendance", cmt_upcoming_meetings:"Upcoming Meetings", cmt_completed_meetings:"Completed Meetings", cmt_no_upcoming:"No upcoming meetings.", cmt_no_completed:"No completed meetings yet.", cmt_no_meetings:"No meetings assigned.", cmt_no_meetings2:"No meetings scheduled yet.", cmt_no_members:"No members yet.", cmt_no_activity:"No activity.", cmt_no_drafts:"No drafts yet.", cmt_joined:"જોડાયા", cmt_also_in:"આમાં પણ", cmt_deactivate:"નિષ્ક્રિય કરો", cmt_activate:"સક્રિય કરો", cmt_present:"હાજર", cmt_absent:"ગેરહાજર", cmt_not_marked:"ચિહ્નિત નથી", cmt_invited:"આમંત્રિત", cmt_scheduled:"નિર્ધારિત", cmt_running:"ચાલુ", cmt_done:"પૂર્ણ", cmt_agenda:"કાર્યસૂચિ", cmt_attendance_list:"હાજરી યાદી", cmt_attendance_history:"હાજરી ઇતિહાસ", cmt_all_present:"બધા હાજર", cmt_all_absent:"બધા ગેરહાજર", cmt_complete:"બેઠક પૂર્ણ કરો", cmt_complete_note:"Once completed, attendance becomes read-only.", cmt_meeting_done:"Meeting completed.", cmt_locked:"This meeting is completed. Attendance is read-only.", cmt_locked_short:"Locked", cmt_calendar:"બેઠક કેલેન્ડર", cmt_settings:"સમિતિ સેટિંગ્સ", cmt_settings_admin:"Full settings including leader assignment", cmt_settings_lead:"Leaders can edit committee details. Leader assignment is admin-only.", cmt_activity_log:"પ્રવૃત્તિ લોગ", cmt_whatsapp:"વોટ્સએપ સંચાર", cmt_whatsapp_sub:"Group, broadcast and reusable draft messages", cmt_group:"વોટ્સએપ ગ્રુપ", cmt_group_name:"Group Name", cmt_group_link:"Group Invite Link", cmt_broadcast:"બ્રોડકાસ્ટ", cmt_broadcast_name:"Broadcast Name", cmt_broadcast_link:"Broadcast Link", cmt_open_group:"Open Group", cmt_open_broadcast:"Open Broadcast", cmt_drafts:"સંદેશ ડ્રાફ્ટ", cmt_new_draft:"નવો ડ્રાફ્ટ", cmt_edit_draft:"Edit Draft", cmt_delete_draft:"Delete Draft", cmt_draft_deleted:"Draft deleted.", cmt_updated:"Updated", cmt_copy:"કૉપિ", cmt_send:"મોકલો", cmt_copied:"Copied.", cmt_copied_paste:"Message copied - paste it in WhatsApp.", cmt_sent:"Message sent", cmt_no_link:"No link saved yet.", cmt_name:"સમિતિ નામ", cmt_samaj:"સમાજ", cmt_expected_size:"અપેક્ષિત કદ", cmt_colour:"રંગ", cmt_purpose:"હેતુ", cmt_select_leader:"Select leader", cmt_access_denied:"Access denied.", cmt_admin_only:"Only an administrator can do this.", cmt_leader_access:"Committee Leader access. You can only open:", cmt_need_name:"Name is required.", cmt_need_leader:"Assign a leader.", cmt_need_purpose:"Purpose is required.", cmt_delete_body:"This deletes the committee, its members, meetings and attendance.", cmt_created:"Committee created", cmt_deleted:"deleted", cmt_updated_by:"Committee updated by", cmt_already_member:"is already on this committee.", cmt_existing_devotee:"Existing devotee", cmt_will_link:"will be linked, not duplicated.", cmt_need_member_name:"First and last name are required.", cmt_need_mobile:"Mobile must be 10 digits.", cmt_added_word:"added", cmt_removed:"removed", cmt_deactivate_body:"They stop appearing in new meetings but history is kept.", cmt_remove_member:"Remove Member", cmt_remove_body:"Removes the committee assignment and its attendance rows. The devotee record is kept.", cmt_no_active_members:"No active members yet.", cmt_need_meeting_title:"Meeting title is required.", cmt_need_datetime:"Date and time are required.", cmt_end_after_start:"End time must be after start time.", cmt_pick_members:"Invite at least one member.", cmt_meeting_updated:"Meeting updated.", cmt_meeting_scheduled:"Meeting scheduled", cmt_delete_meeting:"Delete Meeting", cmt_meeting_deleted:"Meeting deleted.", cmt_need_draft:"Title and message are required.", cmt_no_meeting_row:"No meetings.", ev_title:"મંદિર કાર્યક્રમો", ev_sub:"ઉત્સવો, મહોત્સવો અને સેવા કાર્યક્રમો", ev_add:"કાર્યક્રમ ઉમેરો", ev_edit:"કાર્યક્રમ સંપાદિત કરો", ev_delete:"Delete Event", ev_deleted:"Event deleted.", ev_created:"Event created", ev_updated:"Event updated", ev_kpi_total:"કુલ કાર્યક્રમો", ev_kpi_total_meta:"On the calendar", ev_kpi_upcoming:"આગામી", ev_kpi_upcoming_meta:"Still to come", ev_kpi_footfall:"અંદાજિત હાજરી", ev_kpi_types:"કાર્યક્રમ પ્રકાર", ev_kpi_types_meta:"Master list", ev_open_ws:"કાર્યક્રમ ખોલો", ev_type_catalog:"કાર્યક્રમ પ્રકાર યાદી", ev_type:"પ્રકાર", ev_add_type:"Add Event Type", ev_edit_type:"Edit Event Type", ev_delete_type:"Delete Event Type", ev_type_exists:"That type already exists.", ev_type_in_use:"event(s) use this type.", ev_type_deleted:"Type deleted.", ev_records:"event(s)", ev_unused:"Not used yet", ev_days:"દિવસો", ev_day:"day", ev_incharge:"પ્રભારી", ev_footfall:"હાજરી", ev_budget:"બજેટ", ev_estimate:"Estimate", ev_schedule:"સમયપત્રક", ev_manage_days:"Manage Days", ev_notice:"સૂચના / આમંત્રણ", ev_no_date:"No date", ev_tab_overview:"ઝલક", ev_tab_schedule:"સમયપત્રક", ev_tab_settings:"સેટિંગ્સ", ev_tab_activity:"પ્રવૃત્તિ", ev_st_planning:"આયોજન", ev_st_confirmed:"પુષ્ટ", ev_st_ongoing:"ચાલુ", ev_st_completed:"પૂર્ણ", ev_st_cancelled:"રદ", ev_select_type:"Select type", ev_select_incharge:"Select in-charge", ev_need_name:"Event name is required.", ev_need_type:"Select an event type.", ev_need_day:"Add at least one day.", ev_end_after:"End time must be after start time.", ev_invite_line:"You are cordially invited to", vis_title:"બાપ્પા / ભુવાજી પધરામણી", vis_sub:"ઘર, દુકાન અને પારિવારિક પ્રસંગોમાં પધરામણી — એસ્કોર્ટ ટીમ સાથે", vis_add:"પધરામણી ઉમેરો", vis_add_devotee:"નવો ભક્ત ઉમેરો", vis_pick_devotee:"ભક્ત પસંદ કરો", vis_not_in_register:"રજિસ્ટરમાં નથી", vis_edit:"પધરામણી સંપાદિત કરો", vis_delete:"Delete Visit", vis_deleted:"Visit deleted.", vis_added:"Visit added.", vis_kpi_total:"કુલ પધરામણી", vis_kpi_upcoming:"આગામી", vis_kpi_upcoming_meta:"Scheduled / confirmed", vis_kpi_pending:"મંજૂરી બાકી", vis_kpi_pending_meta:"New requests", vis_kpi_teams:"એસ્કોર્ટ ટીમો", vis_kpi_teams_meta:"On the roster", vis_register:"પધરામણી રજિસ્ટર", vis_devotee:"શ્રદ્ધાળુ", vis_purpose:"હેતુ", vis_address:"સરનામું", vis_datetime:"તારીખ અને સમય", vis_escort:"એસ્કોર્ટ ટીમ", vis_none:"No visits match.", vis_escort_ph:"Team that carries the palki & manages the visit", vis_need_name:"Devotee name is required.", vis_need_date:"Date is required.", vis_explain:"પધરામણી એટલે માતાજીની મૂર્તિ કે ભુવાજી (મંદિરના માધ્યમ) ને શ્રદ્ધાળુના ઘર, દુકાન કે પ્રસંગમાં આશીર્વાદ માટે લઈ જવામાં આવે. એસ્કોર્ટ ટીમ એ સ્વયંસેવક જૂથ છે જે પાલખી ઊંચકે, આરતી થાળી અને ભીડ સંભાળે, મૂર્તિની સલામતી અને પરત યાત્રાનું આયોજન કરે.", vis_p_home_inauguration:"નવું ઘર / વાસ્તુ", vis_p_shop_opening:"દુકાન ઉદ્ઘાટન", vis_p_wedding_blessing:"લગ્ન આશીર્વાદ", vis_p_health_blessing:"આરોગ્ય", vis_p_business_puja:"ધંધો / ફેક્ટરી પૂજા", vis_p_festival_padhramani:"ઉત્સવ પધરામણી", vis_p_other:"અન્ય", vis_s_requested:"વિનંતી", vis_s_scheduled:"નિર્ધારિત", vis_s_confirmed:"પુષ્ટ", vis_s_completed:"પૂર્ણ", vis_s_cancelled:"રદ", cal_title:"સંકલિત મંદિર કેલેન્ડર", cal_sub:"પૂજા, સમિતિ બેઠકો, કાર્યક્રમો, વચનબદ્ધ દાન અને પધરામણી — એક જ જગ્યાએ", cal_sub_public:"સમગ્ર મંદિરની પૂજાઓ, કાર્યક્રમો અને વાર્ષિક તિથિઓ", cal_next:"આગળ", cal_up_next:"હવે પછી", cal_agenda:"આ મહિને", cal_item:"બાબત", cal_type:"પ્રકાર", cal_nothing:"આ મહિને કંઈ નિર્ધારિત નથી.", cal_poojas:"પૂજા", cal_meetings:"બેઠકો", cal_events:"કાર્યક્રમો", cal_annual:"વાર્ષિક", cal_donations:"વચનો", cal_visits:"પધરામણી", cal_pledge:"વચનબદ્ધ દાન", cal_mon:"સોમ", cal_tue:"મંગળ", cal_wed:"બુધ", cal_thu:"ગુરુ", cal_fri:"શુક્ર", cal_sat:"શનિ", cal_sun:"રવિ", cal_more:"વધુ", mg_lead:"મેનેજમેન્ટ આગેવાન", mg_volunteer:"સ્વયંસેવક", mg_id:"આઈડી", pj_inv_royal:"રોયલ (વિધિવત્)", pj_inv_cream:"ક્રીમ (સાદું)", pj_inv_festival:"ઉત્સવ", pj_inv_lang_app:"એપ પ્રમાણે", pj_inv_template:"ટેમ્પલેટ", pj_inv_language:"કાર્ડ ભાષા", pj_inv_accent:"એક્સેન્ટ રંગ", pj_inv_headline:"શીર્ષક", pj_inv_line:"આમંત્રણ પંક્તિ", pj_inv_blessing:"સમાપન આશીર્વાદ", pj_inv_show_schedule:"સંપૂર્ણ સત્ર કાર્યક્રમ બતાવો", pj_inv_show_sevarthi:"સેવાર્થી નામ બતાવો", pj_inv_show_guests:"મહેમાનો બતાવો", pj_inv_save:"કાર્ડ સાચવો", pj_inv_print:"પ્રિન્ટ / PDF", pj_inv_audience:"આમંત્રણ કોને", pj_inv_aud_open:"ખુલ્લું / જાહેર આમંત્રણ (નામ વગર)", pj_inv_aud_grp:"દરેક સમિતિ સભ્ય માટે એક કાર્ડ", pj_inv_aud_hint:"સમાજ / સમિતિ પસંદ કરો — દરેક સભ્ય માટે નામ, શહેર, રાજ્ય સહિત વ્યક્તિગત કાર્ડ બનશે, PDF માં એક-એક પાનું.", pj_inv_aud_preview:"પૂર્વાવલોકન 1 / ", pj_inv_aud_pdf:"પ્રિન્ટ / PDF બધા બનાવે છે", pj_inv_aud_onepage:"પાના દીઠ એક આમંત્રણ", pj_inv_download:"બધા એક PDF માં", pj_inv_print_only:"પ્રિન્ટ", pj_inv_dl_wait:"બની રહ્યું છે…", pj_inv_dl_prog:"રેન્ડર થઈ રહ્યું છે", pj_inv_dl_ok:"આમંત્રણ પાનાં PDF માં સાચવ્યાં.", pj_inv_dl_offline:"PDF એન્જિન ઉપલબ્ધ નથી — પ્રિન્ટ વ્યૂ ખૂલે છે.", pj_inv_dl_fail:"PDF બન્યું નહીં — પ્રિન્ટ વ્યૂ ખૂલે છે.", pj_inv_zip:"ZIP ડાઉનલોડ (અલગ-અલગ)", pj_inv_zip_prog:"પૅક થઈ રહ્યું છે", pj_inv_zip_ok:"આમંત્રણ PDF ZIP માં સાચવ્યાં.", pj_inv_zip_fail:"ZIP બન્યું નહીં — પ્રિન્ટ વ્યૂ ખૂલે છે.", pj_inv_sub2:"પૂજામાંથી આપોઆપ ભરાયેલું. લખાણ, રંગ અને ભાષા બદલો, પછી પ્રિન્ટ કરો અથવા PDF (A5) સાચવો.", pj_edit_pooja:'પૂજા સંપાદિત કરો', pj_all_poojas:'બધી પૂજાઓ', pj_sessions_word:'સત્રો', dash_kpi_pooja:'આજની પૂજાઓ', dash_kpi_don:'આ મહિને દાન', dash_kpi_accounts:'અધિકૃત ખાતાં', dash_kpi_accounts_meta:'પ્લેટફોર્મ ઍક્સેસ સાથે', dash_kpi_month:'આ મહિને', dash_glance:'તમારા મંદિરની એક ઝલક',
      guide_title:'નવા છો? આ પ્લેટફોર્મ કેવી રીતે કામ કરે છે', guide_reopen:'ગાઇડ', guide_hide:'સમજાયું — છુપાવો',
      guide_lead:'આખા મંદિર માટે એક જ પ્લેટફોર્મ. સાઇડબારમાંથી કોઈ વિભાગ પસંદ કરો, અથવા નીચેના શોર્ટકટ વાપરો. દરેક યાદીમાં ઉપર જમણે “ઉમેરો” બટન છે, અને દરેક રેકોર્ડ ટૅબવાળા વર્કસ્પેસમાં ખૂલે છે.',
      guide_modules:'દરેક વિભાગ શેના માટે છે', guide_tasks:'સામાન્ય કામ — ક્યાં જવું', guide_glossary:'અહીં વપરાતા શબ્દો',
      guide_m_puja:'અનુષ્ઠાન અને સેવા શેડ્યૂલ કરો, સેવાર્થી નોંધો, આમંત્રણ છાપો',
      guide_m_events:'તહેવાર આયોજન — નવરાત્રિ, અન્નકૂટ, પાટોત્સવ',
      guide_m_visits:'મૂર્તિ / ભુવાજીને ઘર કે દુકાને લઈ જાઓ, એસ્કોર્ટ ટીમ સાથે',
      guide_m_devotees:'દાન, પૂજા અને સમિતિઓમાં વપરાતી મુખ્ય નોંધ',
      guide_m_cmt:'બાંધકામ શાસન સંસ્થાઓ — સભ્યો, બેઠકો, હાજરી',
      guide_m_mg:'સ્વયંસેવક ટીમો — પ્રસાદ, પાર્કિંગ, શણગાર — રોસ્ટર અને બૅજ',
      guide_m_don:'રોકડ અને વસ્તુ દાન, 80G રસીદો અને પ્રમાણપત્રો',
      guide_m_exp:'વાઉચર સામે મંદિર ખર્ચ નોંધો',
      guide_m_inv:'સામગ્રી, પ્રસાદ અને સંપત્તિ, ઓછા-સ્ટૉક ચેતવણી સાથે',
      guide_m_cal:'દરેક વિભાગની દરેક તારીખવાળી વસ્તુ એક ગ્રિડ પર',
      guide_m_rep:'લાઇવ માસિક આંકડા + ડાઉનલોડ કરી શકાય તેવી નોંધ (CSV / Excel / PDF)',
      guide_m_acc:'કોની પાસે લૉગિન છે અને કોણ શું ખોલી શકે; ઑડિટ ટ્રેલ',
      guide_m_set:'મંદિર ઓળખ, ભાષા, અને રિપોર્ટ ચલાવતી કાર્ય તારીખ',
      guide_t_don:'દાન નોંધો અને 80G રસીદ છાપો', guide_t_pooja:'પૂજા કે તહેવાર સેવા શેડ્યૂલ કરો',
      guide_t_fest:'તહેવાર આયોજન કરો (નવરાત્રિ, અન્નકૂટ…)', guide_t_visit:'બાપ્પા / ભુવાજીને ઘર કે દુકાને મોકલો',
      guide_t_team:'સ્વયંસેવક ટીમ શરૂ કરો (પાર્કિંગ, પ્રસાદ…)', guide_t_login:'કોઈને લૉગિન એક્સેસ આપો',
      guide_t_date:'કાર્ય તારીખ કે મંદિર વિગતો બદલો',
      guide_g_sevarthi:'એ ભક્ત પરિવાર જે પૂજાને સેવા રૂપે પ્રાયોજિત અને સંપન્ન કરે છે.',
      guide_g_padh_k:'પધરામણી / ભુવાજી મુલાકાત', guide_g_padh:'માની મૂર્તિ કે ભુવાજીને ભક્તના ઘર કે દુકાને આશીર્વાદ માટે લઈ જવું.',
      guide_g_cvm_k:'સમિતિ વિ. મેનેજમેન્ટ', guide_g_cvm:'સમિતિ = બાંધકામ શાસન સંસ્થાઓ. મેનેજમેન્ટ = સંચાલન સ્વયંસેવક ટીમો.',
      guide_g_date_k:'કાર્ય તારીખ', guide_g_date:'એ "આજ" જેની સામે દરેક ડૅશબોર્ડ, રિપોર્ટ અને સ્થિતિ મપાય છે — સેટિંગ્સમાં નક્કી કરો.',
      guide_g_scope_k:'"તરીકે જુઓ" (ટોચની પટ્ટી)', guide_g_scope:'મર્યાદિત લૉગિનને દેખાતી ઍપનું પૂર્વાવલોકન કરો. ગમે ત્યારે એડમિનિસ્ટ્રેટર પર પાછા જાઓ.', dash_attention:'ધ્યાન આપવા જેવું', dash_today_temple:'આજે સમગ્ર મંદિરમાં', dash_today_area:'આજે તમારા વિસ્તારમાં', dash_today:'આજે', dash_quiet:'શાંત દિવસ — કંઈ નિર્ધારિત નથી.', dash_your_area:'તમારો વિસ્તાર', dash_no_assign:'તમને હજી કંઈ સોંપાયું નથી.', dash_on_file:'રેકોર્ડમાં', dash_items:'વસ્તુઓ', dash_vouchers:'વાઉચર', dash_a_pledged:'દાન વચન વસૂલાત બાકી', dash_a_visits:'ભુવાજી પધરામણી વિનંતી મંજૂરી બાકી', dash_a_sevarthi:'સેવાર્થી વગરની પૂજાઓ', dash_a_stock:'ઓછો કે ખતમ સ્ટોક વસ્તુઓ', dash_a_attend:'ઓછી બેઠક હાજરીવાળી સમિતિઓ', nav_puja_s:'પૂજા અને સેવા', nav_management_s:'મેનેજમેન્ટ ઍપ્સ', nav_devotees_s:'ભક્તો', nav_inventory_s:'ભંડાર', nav_expenses_s:'ખર્ચ', role_superadmin:'સુપર એડમિન', role_admin:'એડમિન', role_management_lead:'મેનેજમેન્ટ લીડ', role_pooja_coordinator:'પૂજા સંયોજક', role_committee_leader:'સમિતિ આગેવાન', role_event_incharge:'કાર્યક્રમ ઇન્ચાર્જ', role_accountant:'હિસાબનીશ', acc_title:'ખાતાં અને ઍક્સેસ', acc_sub:'દરેક અધિકૃત ખાતું, તે શું ખોલી શકે, અને જીવંત ઓડિટ ટ્રેલ', acc_kpi_total:'અધિકૃત ખાતાં', acc_kpi_total_meta:'બધી ભૂમિકાઓમાં', acc_kpi_admin:'સુપર એડમિન', acc_kpi_admin_meta:'સંપૂર્ણ પ્લેટફોર્મ ઍક્સેસ', acc_kpi_leaders:'આગેવાનો અને સંયોજકો', acc_kpi_leaders_meta:'તેમના વિસ્તાર પૂરતું', acc_kpi_roles:'ઍક્સેસ ભૂમિકાઓ', acc_kpi_roles_meta:'વ્યાખ્યાયિત ભૂમિકા પ્રકાર', acc_by_role:'ભૂમિકા પ્રમાણે ઍક્સેસ', acc_can_open:'ખોલી શકે', acc_everything:'બધું', acc_accounts:'ખાતાં', acc_account_ct:'ખાતું', acc_roles:'ભૂમિકાઓ', acc_signin:'આ રૂપે સાઇન ઇન કરો', acc_audit:'ઓડિટ ટ્રેલ', acc_audit_meta:'જીવંત, દરેક મોડ્યુલમાંથી સંકલિત', acc_module:'મોડ્યુલ', acc_action:'ક્રિયા', acc_when:'ક્યારે', acc_ref_title:'ભૂમિકા અને ઍક્સેસ સંદર્ભ', acc_ref_sub:'નિશ્ચિત ભૂમિકા મોડલ. ફક્ત સુપર એડમિન અને એડમિનને દેખાય છે.', acc_ref_role:'ભૂમિકા', acc_ref_open:'ખોલી શકે તેવાં પાનાં', acc_ref_dash:'દેખાતું ડેશબોર્ડ', acc_ref_cal:'કેલેન્ડરમાં', acc_ref_pages:'પાનાં', rep_title:'રિપોર્ટ અને વિશ્લેષણ', rep_sub:'ચાલુ મહિના માટે દરેક મોડ્યુલમાંથી જીવંત આંકડા', rep_export_all:'પ્રવૃત્તિ લોગ નિકાસ', rep_don:'દાન (રોકડ, મહિનો)', rep_donkind:'વસ્તુ મૂલ્ય (મહિનો)', rep_exp:'ખર્ચ (કુલ)', rep_dev:'નોંધાયેલા ભક્તો', rep_pooja:'પૂજાઓ', rep_cmt:'સમિતિ હાજરી', rep_ev:'કાર્યક્રમો', rep_vis:'ભુવાજી પધરામણી', set_title:'પ્લેટફોર્મ સેટિંગ્સ', set_sub:'મંદિર ઓળખ, ભાષા અને ડેમો ડેટા', set_identity:'મંદિર ઓળખ', set_name:'મંદિરનું નામ', set_loc:'સ્થળ', set_email:'સંપર્ક ઈમેલ', set_phone:'સંપર્ક ફોન', set_platform:'પ્લેટફોર્મ', set_lang:'ડિફોલ્ટ ભાષા', set_clock:'ડેમો ઘડિયાળ', set_accounts_hint:'પ્લેટફોર્મ ઍક્સેસ સંચાલિત કરો', set_page:'પાના પર', set_reset:'નવું લોડ — બધો ડેમો ડેટા રીસેટ કરો', set_clock_title:'કાર્ય તારીખ અને ડેટા', set_clock_sub:'દરેક ડેશબોર્ડ, કેલેન્ડર, પૂજા/કાર્યક્રમ સ્થિતિ અને માસિક રિપોર્ટ આ તારીખ પ્રમાણે ગણાય છે. રેકોર્ડ સમય સાથે કેવી રીતે બદલાય તે જોવા આને ખસેડો.', set_clock_apply:'કાર્ય તારીખ લાગુ કરો', set_clock_reset:'મૂળ તારીખે રીસેટ કરો', set_clock_note:'કસ્ટમ કાર્ય તારીખ સક્રિય છે અને રીલોડ પર યાદ રહે છે.', set_clock_bad:'માન્ય તારીખ પસંદ કરો.', set_clock_done:'કાર્ય તારીખ સેટ કરી', set_reset_confirm:'ફરી લોડ કરી બધો ડેમો ડેટા રીસેટ કરવો?', set_saved:'મંદિર માહિતી સાચવી.', teams_moved:'સ્ટાફ અને સ્વયંસેવક ટીમો હવે મેનેજમેન્ટ મોડ્યુલમાં છે', teams_moved_sub:'સ્વયંસેવક ટીમો, લીડ સોંપણી, સેવા સમયપત્રક, હાજરી અને બેજ બધું મેનેજમેન્ટ ઍપ્સમાં છે.', teams_open:'મેનેજમેન્ટ ઍપ્સ ખોલો', lang_switched:'ભાષા બદલાઈ'
    }
  };

  /* Fixed vocabulary of DATA values that should localize on display.
     Keyed by the canonical English string. */
  var DATA = {
    hi: {
      /* committees / samaj */
      'Rabari Samaj':'रबारी समाज', 'Marvadi Samaj':'मारवाड़ी समाज', 'General Committee':'सामान्य समिति',
      /* cities */
      'Sanand':'साणंद', 'Ahmedabad':'अहमदाबाद', 'Bavla':'बावळा', 'Viramgam':'विरमगाम',
      'Changodar':'चांगोदर', 'Gujarat':'गुजरात',
      /* guest roles */'Chief Guest':'मुख्य अतिथि', 'Guest of Honour':'सम्माननीय अतिथि',
      'Trust President':'ट्रस्ट अध्यक्ष', 'Trustee':'ट्रस्टी', 'Yagna Acharya':'यज्ञ आचार्य',
      'Path Acharya':'पाठ आचार्य', 'Mahila Mandal Head':'महिला मंडल प्रमुख', 'Chief Priest':'मुख्य पुजारी',
      'Guest':'अतिथि', 'Volunteer':'स्वयंसेवक', 'Coordinator':'समन्वयक',
      /* pooja type categories */
      'Special Havan':'विशेष हवन', 'Daily Ritual':'नित्य विधि', 'Abhishek':'अभिषेक',
      'Shanti Pooja':'शांति पूजा', 'Path':'पाठ', 'Special Yagna':'विशेष यज्ञ', 'Seva':'सेवा',
      'Prasad':'प्रसाद', 'Sthapana':'स्थापना', 'Havan':'हवन', 'Utsav':'उत्सव',
      /* --- calendar / catalog data --- */
      'General Temple Committee':'सामान्य मंदिर समिति',
      'Rabari Samaj Committee':'रबारी समाज समिति',
      'Marvadi Samaj Committee':'मारवाड़ी समाज समिति',
      'Monthly Governance Meeting':'मासिक प्रशासन बैठक',
      'Contractor Coordination':'ठेकेदार समन्वय',
      'Contribution Update Request':'अंशदान अद्यतन अनुरोध',
      'Marble & Gold Work Funding':'संगमरमर एवं स्वर्ण कार्य वित्त',
      'Meeting Reminder':'बैठक स्मरण',
      'Navratri Planning':'नवरात्रि नियोजन',
      'Rabari Samaj Collection Review':'रबारी समाज संग्रह समीक्षा',
      'Shram-daan Roster':'श्रमदान रोस्टर',
      'Ahmedabad Office':'अहमदाबाद कार्यालय',
      'Construction Site':'निर्माण स्थल',
      'Rabari Vadi, Sanand':'रबारी वाडी, साणंद',
      'Sabha Mandap':'सभा मंडप',
      'Trust Office, Sanand':'ट्रस्ट कार्यालय, साणंद',
      'Vihat Maa Moorti Sthapan Pooja':'विहत माँ मूर्ति स्थापन पूजा',
      'Sharadiya Navratri Kalash Sthapana':'शारदीय नवरात्रि कलश स्थापना',
      'Shat Chandi Mahayagna':'शत चंडी महायज्ञ',
      'Annakut Mahotsav Darshan':'अन्नकूट महोत्सव दर्शन',
      'Shravan Rudrabhishek Seva':'श्रावण रुद्राभिषेक सेवा',
      'Poonam Chandi Path & Archana':'पूनम चंडी पाठ एवं अर्चना',
      'Sandhya Deepmala Maha Aarti':'संध्या दीपमाला महाआरती',
      'Aahuti Count':'आहुति गणना',
      'Adhivas & Kalash Sthapana':'अधिवास एवं कलश स्थापना',
      'Annakut Darshan':'अन्नकूट दर्शन',
      'Chandi Path':'चंडी पाठ',
      'Deepmala Aarti':'दीपमाला आरती',
      'Diya Count':'दीया गणना',
      'Idol Height':'मूर्ति ऊँचाई',
      'Kalash Sthapana':'कलश स्थापना',
      'Mahayagna & Purnahuti':'महायज्ञ एवं पूर्णाहुति',
      'Moorti Sthapan & Prana Pratishtha':'मूर्ति स्थापन एवं प्राण प्रतिष्ठा',
      'Muhurat':'मुहूर्त',
      'Navgraha & Panchang Pooja':'नवग्रह एवं पंचांग पूजा',
      'Rudrabhishek':'रुद्राभिषेक',
      'Garbha Mandap':'गर्भ मंडप',
      'Main Sabha Mandap':'मुख्य सभा मंडप',
      'Shree Vihat Meldi Dham Sanand':'श्री विहत मेलडी धाम, साणंद',
      'Shri Vihat Meldi Dham Sanand':'श्री विहत मेलडी धाम, साणंद',
      'Shiv Mandir':'शिव मंदिर',
      'Yagna Shala':'यज्ञ शाला',
      /* --- scheduled pooja master list (Feb consecration, PTY-001..017) --- */
      'Kalash Pooja':'कलश पूजा',
      'Mataji First Aarti':'माताजी की प्रथम आरती',
      "Samaran's Main Kalash Pooja":'सामरण का मुख्य कलश',
      'Shri Yantra Pooja':'श्री यंत्र पूजा',
      'Shri Ganesh Pooja':'श्री गणेश',
      'Shri Hanuman Pooja':'श्री हनुमान',
      'Four Chowki Kalash Pooja':'चौकी के चार कलश (सामरण कलश पूजा)',
      'Garbha Gruh Na Ubra Ni Pooja':'गर्भ गृह के उबरा की पूजा',
      'Sukhanath Pooja':'सुखनाथ',
      'Dharma Dhaja Pooja':'धर्म ध्वजा',
      'Ubra Ni Pooja':'उबरा की पूजा',
      'Mataji First Shringar':'माताजी का प्रथम शृंगार',
      'Four Directions Deities Pooja':'चार दिशाओं के देव',
      'Six Elephants Pooja (Airavat)':'छह हाथी (ऐरावत)',
      'Dhwaja Stambha Pooja':'ध्वजा दंड',
      'Main Dhwaja Pooja':'मुख्य ध्वजा',
      'Stambh Murti Pooja':'स्तंभ की मूर्ति पूजा (126 मूर्ति)',
      'Meldi Mata Poonam Dayro':'मेलडी माता पूनम डायरो',
      'Meldi Mata Poonam Dayro — September':'मेलडी माता पूनम डायरो — सितंबर',
      'Sharad Purnima Seva':'शरद पूर्णिमा सेवा',
      'Sharad Purnima Kheer Seva':'शरद पूर्णिमा खीर सेवा',
      'Navratri Mahotsav':'नवरात्रि महोत्सव',
      'Navratri Mahotsav 2026':'नवरात्रि महोत्सव 2026',
      'Annakut Mahotsav':'अन्नकूट महोत्सव',
      'Annakut Mahotsav 2026':'अन्नकूट महोत्सव 2026',
      'Patotsav (Foundation Day)':'पाटोत्सव (स्थापना दिवस)',
      'Dhwaja Aarohan':'ध्वजा आरोहण',
      'Dhwaja Aarohan — Poonam':'ध्वजा आरोहण — पूनम',
      'Lok Dayro / Santvani':'लोक डायरो / संतवाणी',
      'Shobha Yatra':'शोभा यात्रा',
      'Diwali Chopda Pujan':'दिवाली चोपड़ा पूजन',
      'Holi Dhuleti Utsav':'होली धुळेटी उत्सव',
      'Bhojan Shala':'भोजन शाला',
      'Garbha Mandap & Mahotsav Ground':'गर्भ मंडप एवं महोत्सव मैदान',
      'Mahotsav Ground':'महोत्सव मैदान',
      'Shikhar':'शिखर',
      'Adornment of the deity':'देव शृंगार',
      'Annakut & daily annadan':'अन्नकूट एवं नित्य अन्नदान',
      'New shikhar cladding':'नया शिखर आवरण',
      'Sabha Mandap marble flooring':'सभा मंडप संगमरमर फर्श',
      'Temple corpus / treasury':'मंदिर कोष / ट्रेज़री',
      'Temple gaushala':'मंदिर गौशाला',
      'Rajasthan':'राजस्थान',
      /* --- volunteering session titles / locations --- */
      'Annadan Prasad Distribution':'अन्नदान प्रसाद वितरण',
      'Evening Aarti VIP Desk':'संध्या आरती VIP डेस्क',
      'Evening Traffic Control':'संध्या यातायात नियंत्रण',
      'Gate Screening Duty':'द्वार जाँच ड्यूटी',
      'Mahotsav Stage Setup':'महोत्सव मंच व्यवस्था',
      'Morning Darshan Assistance':'प्रातः दर्शन सहायता',
      'Navratri Day 1 VIP Reception':'नवरात्रि दिवस 1 VIP स्वागत',
      'Navratri Parking Roster':'नवरात्रि पार्किंग रोस्टर',
      'Poonam Dayro Programme Duty':'पूनम डायरो कार्यक्रम ड्यूटी',
      'Poonam Dayro VIP Seating':'पूनम डायरो VIP बैठक व्यवस्था',
      'Poonam Parking Deployment':'पूनम पार्किंग तैनाती',
      'Prasad Packing Drive':'प्रसाद पैकिंग अभियान',
      'Sound & Light Trial':'ध्वनि एवं प्रकाश परीक्षण',
      'Sunday Rush Parking Duty':'रविवार भीड़ पार्किंग ड्यूटी',
      'VIP Guest Reception':'VIP अतिथि स्वागत',
      'All Parking Zones':'सभी पार्किंग क्षेत्र',
      'Darshan Queue Hall':'दर्शन कतार हॉल',
      'Main Gate':'मुख्य द्वार',
      'Main Temple Entrance':'मुख्य मंदिर प्रवेश',
      'North Parking Lot':'उत्तर पार्किंग स्थल',
      'Prasad Store Room':'प्रसाद भंडार कक्ष',
      'Temple Approach Road':'मंदिर पहुँच मार्ग'
    },
    gu: {
      'Rabari Samaj':'રબારી સમાજ', 'Marvadi Samaj':'મારવાડી સમાજ', 'General Committee':'સામાન્ય સમિતિ',
      'Sanand':'સાણંદ', 'Ahmedabad':'અમદાવાદ', 'Bavla':'બાવળા', 'Viramgam':'વિરમગામ',
      'Changodar':'ચાંગોદર', 'Gujarat':'ગુજરાત','Chief Guest':'મુખ્ય મહેમાન', 'Guest of Honour':'સન્માનનીય મહેમાન',
      'Trust President':'ટ્રસ્ટ પ્રમુખ', 'Trustee':'ટ્રસ્ટી', 'Yagna Acharya':'યજ્ઞ આચાર્ય',
      'Path Acharya':'પાઠ આચાર્ય', 'Mahila Mandal Head':'મહિલા મંડળ પ્રમુખ', 'Chief Priest':'મુખ્ય પૂજારી',
      'Guest':'મહેમાન', 'Volunteer':'સ્વયંસેવક', 'Coordinator':'સંયોજક',
      'Special Havan':'વિશેષ હવન', 'Daily Ritual':'નિત્ય વિધિ', 'Abhishek':'અભિષેક',
      'Shanti Pooja':'શાંતિ પૂજા', 'Path':'પાઠ', 'Special Yagna':'વિશેષ યજ્ઞ', 'Seva':'સેવા',
      'Prasad':'પ્રસાદ', 'Sthapana':'સ્થાપના', 'Havan':'હવન', 'Utsav':'ઉત્સવ',
      /* --- calendar / catalog data --- */
      'General Temple Committee':'સામાન્ય મંદિર સમિતિ',
      'Rabari Samaj Committee':'રબારી સમાજ સમિતિ',
      'Marvadi Samaj Committee':'મારવાડી સમાજ સમિતિ',
      'Monthly Governance Meeting':'માસિક વહીવટ બેઠક',
      'Contractor Coordination':'કોન્ટ્રાક્ટર સંકલન',
      'Contribution Update Request':'ફાળા અપડેટ વિનંતી',
      'Marble & Gold Work Funding':'આરસ અને સોના કામ ભંડોળ',
      'Meeting Reminder':'બેઠક રિમાઇન્ડર',
      'Navratri Planning':'નવરાત્રિ આયોજન',
      'Rabari Samaj Collection Review':'રબારી સમાજ ઉઘરાણી સમીક્ષા',
      'Shram-daan Roster':'શ્રમદાન રોસ્ટર',
      'Ahmedabad Office':'અમદાવાદ કાર્યાલય',
      'Construction Site':'બાંધકામ સ્થળ',
      'Rabari Vadi, Sanand':'રબારી વાડી, સાણંદ',
      'Sabha Mandap':'સભા મંડપ',
      'Trust Office, Sanand':'ટ્રસ્ટ કાર્યાલય, સાણંદ',
      'Vihat Maa Moorti Sthapan Pooja':'વિહત મા મૂર્તિ સ્થાપન પૂજા',
      'Sharadiya Navratri Kalash Sthapana':'શારદીય નવરાત્રિ કળશ સ્થાપના',
      'Shat Chandi Mahayagna':'શત ચંડી મહાયજ્ઞ',
      'Annakut Mahotsav Darshan':'અન્નકૂટ મહોત્સવ દર્શન',
      'Shravan Rudrabhishek Seva':'શ્રાવણ રુદ્રાભિષેક સેવા',
      'Poonam Chandi Path & Archana':'પૂનમ ચંડી પાઠ અને અર્ચના',
      'Sandhya Deepmala Maha Aarti':'સંધ્યા દીપમાળા મહાઆરતી',
      'Aahuti Count':'આહુતિ ગણતરી',
      'Adhivas & Kalash Sthapana':'અધિવાસ અને કળશ સ્થાપના',
      'Annakut Darshan':'અન્નકૂટ દર્શન',
      'Chandi Path':'ચંડી પાઠ',
      'Deepmala Aarti':'દીપમાળા આરતી',
      'Diya Count':'દીવા ગણતરી',
      'Idol Height':'મૂર્તિ ઊંચાઈ',
      'Kalash Sthapana':'કળશ સ્થાપના',
      'Mahayagna & Purnahuti':'મહાયજ્ઞ અને પૂર્ણાહુતિ',
      'Moorti Sthapan & Prana Pratishtha':'મૂર્તિ સ્થાપન અને પ્રાણ પ્રતિષ્ઠા',
      'Muhurat':'મુહૂર્ત',
      'Navgraha & Panchang Pooja':'નવગ્રહ અને પંચાંગ પૂજા',
      'Rudrabhishek':'રુદ્રાભિષેક',
      'Garbha Mandap':'ગર્ભ મંડપ',
      'Main Sabha Mandap':'મુખ્ય સભા મંડપ',
      'Shree Vihat Meldi Dham Sanand':'શ્રી વિહત મેલડી ધામ, સાણંદ',
      'Shri Vihat Meldi Dham Sanand':'શ્રી વિહત મેલડી ધામ, સાણંદ',
      'Shiv Mandir':'શિવ મંદિર',
      'Yagna Shala':'યજ્ઞ શાળા',
      /* --- scheduled pooja master list (Feb consecration, PTY-001..017) --- */
      'Kalash Pooja':'કળશ પૂજા',
      'Mataji First Aarti':'માતાજીની પ્રથમ આરતી',
      "Samaran's Main Kalash Pooja":'સામરણનો મેઈન કળશ',
      'Shri Yantra Pooja':'શ્રી યંત્રની પૂજા',
      'Shri Ganesh Pooja':'શ્રી ગણેશ',
      'Shri Hanuman Pooja':'શ્રી હનુમાન',
      'Four Chowki Kalash Pooja':'ચૌકીના ચાર કળશ (સામરણના કળશની પૂજા)',
      'Garbha Gruh Na Ubra Ni Pooja':'ગર્ભ ગૃહના ઉબરા ની પૂજા',
      'Sukhanath Pooja':'સુખનાથ',
      'Dharma Dhaja Pooja':'ધર્મ ધજા',
      'Ubra Ni Pooja':'ઉબરા ની પૂજા',
      'Mataji First Shringar':'માતાજીનો પ્રથમ શણગાર',
      'Four Directions Deities Pooja':'ચાર દિશાના દેવ',
      'Six Elephants Pooja (Airavat)':'છ હાથી (ઐરાવત)',
      'Dhwaja Stambha Pooja':'ધજા દંડ',
      'Main Dhwaja Pooja':'મેઈન ધજા',
      'Stambh Murti Pooja':'સ્તંભની મૂર્તિની પૂજા (126 મૂર્તિ)',
      'Meldi Mata Poonam Dayro':'મેલડી માતા પૂનમ ડાયરો',
      'Meldi Mata Poonam Dayro — September':'મેલડી માતા પૂનમ ડાયરો — સપ્ટેમ્બર',
      'Sharad Purnima Seva':'શરદ પૂર્ણિમા સેવા',
      'Sharad Purnima Kheer Seva':'શરદ પૂર્ણિમા ખીર સેવા',
      'Navratri Mahotsav':'નવરાત્રિ મહોત્સવ',
      'Navratri Mahotsav 2026':'નવરાત્રિ મહોત્સવ 2026',
      'Annakut Mahotsav':'અન્નકૂટ મહોત્સવ',
      'Annakut Mahotsav 2026':'અન્નકૂટ મહોત્સવ 2026',
      'Patotsav (Foundation Day)':'પાટોત્સવ (સ્થાપના દિવસ)',
      'Dhwaja Aarohan':'ધ્વજા આરોહણ',
      'Dhwaja Aarohan — Poonam':'ધ્વજા આરોહણ — પૂનમ',
      'Lok Dayro / Santvani':'લોક ડાયરો / સંતવાણી',
      'Shobha Yatra':'શોભા યાત્રા',
      'Diwali Chopda Pujan':'દિવાળી ચોપડા પૂજન',
      'Holi Dhuleti Utsav':'હોળી ધુળેટી ઉત્સવ',
      'Bhojan Shala':'ભોજન શાળા',
      'Garbha Mandap & Mahotsav Ground':'ગર્ભ મંડપ અને મહોત્સવ મેદાન',
      'Mahotsav Ground':'મહોત્સવ મેદાન',
      'Shikhar':'શિખર',
      'Adornment of the deity':'દેવ શૃંગાર',
      'Annakut & daily annadan':'અન્નકૂટ અને નિત્ય અન્નદાન',
      'New shikhar cladding':'નવું શિખર ક્લેડિંગ',
      'Sabha Mandap marble flooring':'સભા મંડપ આરસ ફર્શ',
      'Temple corpus / treasury':'મંદિર કોષ / તિજોરી',
      'Temple gaushala':'મંદિર ગૌશાળા',
      'Rajasthan':'રાજસ્થાન',
      /* --- volunteering session titles / locations --- */
      'Annadan Prasad Distribution':'અન્નદાન પ્રસાદ વિતરણ',
      'Evening Aarti VIP Desk':'સંધ્યા આરતી VIP ડેસ્ક',
      'Evening Traffic Control':'સંધ્યા ટ્રાફિક નિયંત્રણ',
      'Gate Screening Duty':'ગેટ તપાસ ડ્યુટી',
      'Mahotsav Stage Setup':'મહોત્સવ સ્ટેજ સેટઅપ',
      'Morning Darshan Assistance':'સવારે દર્શન સહાય',
      'Navratri Day 1 VIP Reception':'નવરાત્રિ દિવસ 1 VIP સ્વાગત',
      'Navratri Parking Roster':'નવરાત્રિ પાર્કિંગ રોસ્ટર',
      'Poonam Dayro Programme Duty':'પૂનમ ડાયરો કાર્યક્રમ ડ્યુટી',
      'Poonam Dayro VIP Seating':'પૂનમ ડાયરો VIP બેઠક વ્યવસ્થા',
      'Poonam Parking Deployment':'પૂનમ પાર્કિંગ ગોઠવણ',
      'Prasad Packing Drive':'પ્રસાદ પેકિંગ ડ્રાઇવ',
      'Sound & Light Trial':'ધ્વનિ અને પ્રકાશ પરીક્ષણ',
      'Sunday Rush Parking Duty':'રવિવાર ભીડ પાર્કિંગ ડ્યુટી',
      'VIP Guest Reception':'VIP મહેમાન સ્વાગત',
      'All Parking Zones':'બધા પાર્કિંગ ઝોન',
      'Darshan Queue Hall':'દર્શન કતાર હોલ',
      'Main Gate':'મુખ્ય દરવાજો',
      'Main Temple Entrance':'મુખ્ય મંદિર પ્રવેશ',
      'North Parking Lot':'ઉત્તર પાર્કિંગ સ્થળ',
      'Prasad Store Room':'પ્રસાદ સ્ટોર રૂમ',
      'Temple Approach Road':'મંદિર પહોંચ માર્ગ'
    }
  };

  var _lang = 'en';
  try { var s = localStorage.getItem(LS_KEY); if (s && LANGS.indexOf(s) !== -1) _lang = s; } catch (e) {}

  var _hooks = [];

  window.I18N = UI;
  window.currentLang = function () { return _lang; };
  window.onLanguageChange = function (fn) { if (typeof fn === 'function') _hooks.push(fn); };

  /** UI string by key, with graceful fallback (en → key). */
  window.t = function (key, fallback) {
    var d = UI[_lang] || UI.en;
    if (d[key] != null) return d[key];
    if (UI.en[key] != null) return UI.en[key];
    return fallback != null ? fallback : key;
  };

  /** Localize a known DATA value (name/category/role/city). Unknown → returned as-is.
      Optional langOverride ('en'/'hi'/'gu') localizes against that language instead
      of the app-wide toggle — used by a per-card language selector (the invitation
      designers) so a card set to Gujarati still translates catalog pooja names even
      while the rest of the app is in English. */
  window.tData = function (value, langOverride) {
    var lang = langOverride || _lang;
    if (value == null || lang === 'en') return value == null ? '' : value;
    var map = DATA[lang] || {};
    return map[value] != null ? map[value] : value;
  };

  /** Pick obj.field_<lang> if present, else obj.field. */
  window.tField = function (obj, field) {
    if (!obj) return '';
    if (_lang !== 'en' && obj[field + '_' + _lang] != null && obj[field + '_' + _lang] !== '') {
      return obj[field + '_' + _lang];
    }
    return obj[field] != null ? obj[field] : '';
  };

  /* ---- locale-aware date / time / number formatting (used by every calendar) ---- */
  function _bcp47() { return _lang === 'gu' ? 'gu-IN' : _lang === 'hi' ? 'hi-IN' : 'en-GB'; }
  window.locBcp47 = _bcp47;
  /** "September 2026" → localized month + year for a 0-indexed month. */
  window.locMonthYear = function (y, mo) {
    try { return new Date(y, mo, 1).toLocaleDateString(_bcp47(), { month: 'long', year: 'numeric' }); }
    catch (e) { return (y || '') + '-' + String((mo || 0) + 1); }
  };
  /** "6 Sep 2026" from an ISO yyyy-mm-dd. */
  window.locDate = function (iso) {
    if (!iso) return '';
    var d = new Date(String(iso) + 'T00:00:00');
    if (isNaN(d.getTime())) return String(iso);
    try { return d.toLocaleDateString(_bcp47(), { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return String(iso); }
  };
  /** "7:00 AM" from "07:00". */
  window.locTime = function (t) {
    if (!t) return '';
    var p = String(t).split(':');
    var d = new Date(2000, 0, 1, parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0);
    try { return d.toLocaleTimeString(_bcp47(), { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return String(t); }
  };
  /** grouped number in the active locale (Gujarati / Devanagari numerals when set). */
  window.locNum = function (n) {
    try { return Number(n || 0).toLocaleString(_bcp47()); } catch (e) { return String(n || 0); }
  };
  /** Monday-first array of short weekday names for calendar headers. */
  window.locDowShort = function () {
    return [window.t('cal_mon', 'Mon'), window.t('cal_tue', 'Tue'), window.t('cal_wed', 'Wed'),
            window.t('cal_thu', 'Thu'), window.t('cal_fri', 'Fri'), window.t('cal_sat', 'Sat'),
            window.t('cal_sun', 'Sun')];
  };

  /** A real backend timestamp (sessions.last_seen, audit_logs.created_at,
      any *At/*_at column) — SQLite's datetime('now') stores these in UTC
      with no offset marker — converted to the temple's own Asia/Kolkata
      wall-clock time for display, mirroring server/services/settingsStore.js
      istNow(). NOT the same job as locDate/locTime above: those pretty-print
      a value that's already the correct civil date/time (a pooja session's
      entered date, a "07:00" field); this one converts a real UTC instant.
      "2026-09-19 12:38:00" -> "19 Sep 2026, 6:08 PM". */
  window.fmtServerTimeIST = function (raw) {
    if (!raw) return '';
    var iso = String(raw).trim().replace(' ', 'T');
    if (!/[Zz]|[+-]\d\d:?\d\d$/.test(iso)) iso += 'Z';   // no offset marker -> assume UTC
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(raw);
    try {
      return d.toLocaleString(_bcp47(), {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch (e) { return String(raw); }
  };
  /** Monday-first weekday index (0=Mon..6=Sun) of `todayIso` ('YYYY-MM-DD'),
      but ONLY when it falls inside the month being viewed (viewYear /
      0-indexed viewMonth) — otherwise -1, so a calendar showing some other
      month never highlights a weekday column that isn't actually "today".
      Used to tint the day-of-week header (e.g. શનિ) alongside the date
      cell itself, so "today" reads at a glance on a small screen too. */
  window.todayDowIndex = function (viewYear, viewMonth, todayIso) {
    if (!todayIso) return -1;
    const p = String(todayIso).split('-').map(Number);
    if (p.length !== 3 || p[0] !== viewYear || (p[1] - 1) !== viewMonth) return -1;
    return (new Date(viewYear, viewMonth, p[2]).getDay() + 6) % 7;
  };

  /** Walk the DOM and apply data-i18n / data-i18n-ph / data-i18n-html. */
  window.applyStaticI18n = function (root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = window.t(el.getAttribute('data-i18n'));
      if (v != null) el.textContent = v;
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var v = window.t(el.getAttribute('data-i18n-ph'));
      if (v != null) el.setAttribute('placeholder', v);
    });
    scope.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var v = window.t(el.getAttribute('data-i18n-html'));
      if (v != null) el.innerHTML = v;
    });
    document.documentElement.setAttribute('lang', _lang);
  };

  /** Public entry — used by the topbar <select> and on load. */
  window.setLanguage = function (lang, opts) {
    if (LANGS.indexOf(lang) === -1) lang = 'en';
    _lang = lang;
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    window.applyStaticI18n();
    _hooks.forEach(function (fn) { try { fn(lang); } catch (e) {} });
    if (opts && opts.announce !== false && typeof showToast === 'function') {
      var names = { en: 'English', hi: 'हिन्दी (Hindi)', gu: 'ગુજરાતી (Gujarati)' };
      showToast(window.t('lang_switched') + ': ' + names[lang]);
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    var sel = document.getElementById('langSelect');
    if (sel) sel.value = _lang;
    window.applyStaticI18n();
    _hooks.forEach(function (fn) { try { fn(_lang); } catch (e) {} });
  });
})();
