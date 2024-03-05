export const DarkModeCSS = `body{background-color:#0b0c0c !important;color: #fff !important; background-image: unset !important}
.playControls__inner, .playControls__bg{background-color:#121414 !important;}
.playControl{filter:invert(100%) !important;}
.skipControl__previous{filter:invert(100%) !important;}
.skipControl__next{filter: invert(100%) !important;}
.shuffleControl{filter: invert(100%) !important;}
.repeatControl.m-none{filter: invert(100%) !important;}
.volume[data-level='6'] .volume__button, .volume[data-level='7'] .volume__button, .volume[data-level='8'] .volume__button, .volume[data-level='9'] .volume__button, .volume[data-level='10'] .volume__button{filter: invert(100%) !important;}
.volume[data-level='1'] .volume__button, .volume[data-level='2'] .volume__button, .volume[data-level='3'] .volume__button, .volume[data-level='4'] .volume__button, .volume[data-level='5'] .volume__button{filter: invert(100%) !important;}
.volume.muted .volume__button{filter: invert(100%) !important;}
.volume__button{filter: invert(100%) !important;}
.playbackTimeline__duration{filter: invert(100%) !important;}
.l-container{background-color: #161719 !important;}
.playbackSoundBadge__titleLink, .playbackSoundBadge__titleLink:visited{filter: invert(100%) !important;}
a.playbackSoundBadge__lightLink:hover, a.playbackSoundBadge__lightLink:focus{filter: invert(100%) !important;}
.g-tabs-link, .g-tabs-link:visited{color: #8b9191 !important}
.g-tabs-link.active{color: #f50 !important}
.sc-button-small.sc-button-icon:not(.sc-button-stretch-icon), .sc-button-small.sc-button-responsive:not(.sc-button-stretch-icon){background-color: #000 !important}
.sound__soundActions{background-color: transparent !important}
.soundActions{background-color: transparent !important}
/*.soundTitle__title .sc-truncate{filter: invert(100%) !important;}*/
.soundBadge .soundTitle__username{filter: invert(100%) !important;}
a.sc-link-dark{filter: invert(100%) !important;}
.soundContext__line .sc-ministats{color: #fff !important}
.sc-border-light-right{border-right: 1px solid #F85402 !important}
.sc-border-light-bottom{border-bottom: 1px solid #F85402 !important}
.playControls__inner, .playControls__bg{border-top: unset !important}
.playbackSoundBadge__showQueue{filter: invert(100%) !important;}
.sc-button{color: #fff !important; border: 0px solid #fff !important}
.sc-button-small.sc-button-share:before{filter: invert(100%) !important;}
.sc-button-small.sc-button-more:before{filter: invert(100%) !important;}
.sc-buylink, .sc-buylink:visited{filter: invert(100%) !important;}
.dialog{background: #060707 !important; border: 0px solid #ccc !important}
.dialog__arrow{background: #060707 !important}
.volume__sliderWrapper{background-color: #060707 !important; border: 0px solid transparent !important}
.listenEngagement{border: 0px solid #fff !important; box-shadow: 0 1px 0 0 #44494f !important}
.l-listen-wrapper .l-about-rows{border-right: 1px solid #44494f !important}
.sc-button{background-color: #000 !important}
.commentForm.m-active .commentForm__wrapper{background: unset !important}
.commentForm__wrapper{background: unset !important; border: 0px solid #000 !important}
.commentForm__input{background: #111214; border: 1px solid #303133 !important}
textarea, select, button, input{color: #fff !important}
.g-dark textarea, .g-dark select, .g-dark input[type="text"], .g-dark input[type="password"], .g-dark input[type="search"]{color: #ccc !important}
.g-tabs{border-bottom: 1px solid #44494f !important}
.sc-tag, .sc-tag:visited{background: #1e1f21 !important;border:1px solid #353535 !important}
.sc-button-medium.sc-button-share:before{filter: invert(100%) !important}
.sc-button-selected.sc-button-medium.sc-button-more:before, .sc-button-active.sc-button-medium.sc-button-more:before{filter: invert(0%) !important;}
.sc-button-medium.sc-button-more:before{filter: invert(100%) !important}
.modal__modal{background: #111214 !important}
.modal.modalWhiteout{background-color: rgba(1,1,1,.9) !important}
.composeTextfield .textfield__input{background: #000 !important}
.recipientChooser .tokenInput__wrapper{background-color: #000 !important}
textarea, select, input{background: #000 !important}
.tokenInput__token{background: #212121 !important}
.fullHero{background: #121414 !important}
.moreActions__button, .moreActions__link{background-color: #0b0c0c !important}
.moreActions__button:not(:last-child), .moreActions__link{border-bottom: 1px solid #232323 !important}
.sc-button-queue:before{filter: invert(100%) !important;}
.sc-button-medium.sc-button-addtoset:before{filter: invert(100%) !important;}
.sc-button-medium.sc-button-startstation:before{filter: invert(100%) !important;}
.moreActions{border: 1px solid #232323 !important}
.g-modal-section{background: #111214 !important}
.tabs__tabs, .tabs__headingContainer{background: #111214 !important}
.queue{background-color: #111214 !important}
.queue__hide:focus, .queue__hide:hover, .queue__hide{filter: invert(100%) !important;}
.queue__itemWrapper{background-color: #151619 !important}
.queueFallback__stationMode{border-top: 1px solid #232323 !important}
.queueItemView:hover, .queueItemView.m-active{background: #151619 !important}
.header{background: #111111 !important}
.sc-border-light-top{border-top: 1px solid #44494f !important}
.commentBadgeList__item:first-child {border-top: 0 !important;} /* Do not display a border for first comment on profile page. */
.profileHeaderBackground{background: #111111 !important}
.l-fixed-top-one-column>.l-top{background: #161719 !important} /* Fixes profile's likes page header */
.sc-button-medium.sc-button-message:before{filter: invert(100%) !important;}
.g-tabs-link:hover, .g-tabs-link:focus{border-color: #fff !important}
.dropbar__content{background-color: #0c0c0c !important}
.infoStats__value{color: #fff !important}
.truncatedAudioInfo.m-overflow.m-collapsed .truncatedAudioInfo__wrapper::after{background: linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.1) 90%,#000) !important}
.sc-button-selected.sc-button-medium.sc-button-like:before{filter: invert(0%) !important;}
.sc-button-medium.sc-button-like:before{filter: invert(100%) !important;}
.sc-button-selected.sc-button-medium.sc-button-repost:before{filter: invert(0%) !important;}
.sc-button-medium.sc-button-repost:before{filter: invert(100%) !important}
.commentItem.m-creatorComment{background-color: #232323 !important}
.volume__sliderWrapper:before{border-color: transparent transparent #060707 #060707 !important}
.volume__sliderWrapper:after{border-color: transparent transparent #060707 #060707 !important}
.sc-button-medium.sc-button-edit:before{filter: invert(100%) !important;}
.sc-button-small.sc-button-more.sc-button-lightfg:before{filter: invert(0%) !important;}
.uploadLoggedOut__testimonialsTitle{color: #000 !important}
.uploadLoggedOut__testimonialsText, .uploadLoggedOut__toolsText{color: #000 !important}
.uploadLoggedOut__testimonialListItemQuote{color: #000 !important}
.uploadLoggedOut__toolsText{color: #fff !important}
.productsMiniTable{color: #000 !important}
.listenLogin{background-color: #232323 !important;border: 1px solid #f50 !important}
.g-scrollable-v .g-scrollable-inner{background-color: #121414 !important}
.chartTrack.m-playing, .chartTrack:hover{background: #111111 !important}
.sc-button-small.sc-button-like:before{filter: invert(100%) !important;}
.sc-button-small.sc-button-repost:before{filter: invert(100%) !important;}
.sc-button-small.sc-button-selected.sc-button-more:before, .sc-button-small.sc-button-active.sc-button-more:before{filter: invert(0%) !important;}
.linkMenu{background-color: #0b0c0c !important}
.sidebarInfoBox__body{background-color: #0b0c0c !important}
.sc-text{color: #f50 !important}
.sc-button-small.sc-button-selected.sc-button-like:before, .sc-button-small.sc-button-selected.sc-button-like.sc-button-lightfg:before, .sc-button-small.sc-button-selected.sc-button-like.sc-button-visual:before{filter: invert(0%) !important;}
.sc-button-small.sc-button-selected.sc-button-repost:before, .sc-button-small.sc-button-selected.sc-button-repost.sc-button-lightfg:before, .sc-button-small.sc-button-selected.sc-button-repost.sc-button-visual:before{filter: invert(0%) !important;}
.soundBadge__additional{background: unset !important}
.searchTitle{background-color: #161719 !important}
.g-nav-item>.g-nav-link{color: #fff !important}
.uploadMain__chooserContainer{background-color: #121414 !important}
.sc-border-light{border: 1px solid #f50 !important}
.uploadMain__foot{background-color: unset !important}
.sc-background-white{background-color: unset !important}
.sc-background-light{background-color: unset !important}
.statsOverview__separator{background-color: unset !important}
.dateSelectStats__datepicker{background: #0b0c0c !important}
.sc-button-small.sc-button-edit:before{filter: invert(100%) !important;}
.sc-button-medium.sc-button-addtoset:before{filter: invert(100%) !important;}
.conversation__actions{background: #0B0C0C !important;box-shadow: 0 1px 0 #F85402 !important;}
.inboxItem:hover, .inboxItem:focus, .inboxItem.unread, .inboxItem.active{background-color: #0B0C0C !important;}
.inbox__item:before{background-color: #F85402 !important;}
.g-type-marketing-header{color: black !important;}
.g-type-marketing-info{color: black !important;}
.playControls__castControl>button{filter: invert(100%) !important;}
.removeFromNextUp:hover, .removeFromNextUp{background-color: #404040 !important;}
.queue__hide:focus, .queue__hide:hover, .queue__hide{background-color: white !important;}
.queue__dragCover .m-active {background-color: black !important;}
.trackItem.hover, .trackItem.active{background-color: black !important;}
.trackItem:not(.m-disabled).hover .trackItem__additional {background: linear-gradient(to right,rgba(11,12,12,.1),black 17px) !important;}
.trackItem:not(.m-disabled).active .trackItem__additional {background: linear-gradient(to right,rgba(11,12,12,.1),black 17px) !important;}
.sc-snippet-badge-small{filter: invert(100%) !important;}
.compactTrackListItem.clickToPlay.active{background-color: black !important;}
.compactTrackListItem.clickToPlay:hover{background-color: #070707 !important;}
.compactTrackListItem.clickToPlay.active .compactTrackListItem__additional{background: black !important;}
.compactTrackListItem.clickToPlay:hover .compactTrackListItem__additional{background: #070707 !important;}
.compactTrackListItem__trackTitle{color: #757575 !important;}
.compactTrackListItem__user{color: #c0c0c0 !important;}
.activeUpload.m-hq-upload-note .activeUpload__hqNote{background-color: #0002 !important;}
.activeUpload__form{background-color: transparent !important;}
.suggestedTags{background-color: black !important;}
.suggestedTags__listItem.selected{background-color: #ff7000 !important;}
.tagInput__wrapper{background-color: transparent !important;}
.sc-button-dropdown:focus:not(.sc-button-disabled):not(:disabled){box-shadow: 0 0 0 4px #353535 !important;}
.g-upsell-container{background: transparent !important;}
.ui-datepicker{background: #212121 !important;}
.activeUpload__shareContainer{background-color: transparent !important;}
.audibleEditForm__form{background-color: transparent !important;}
.audibleEditForm__audio{background-color: #191919 !important;}
.commentPopover.darkText .commentPopover__body{color: #8d8d8d !important;}
.paging-eof{filter: invert(90.6%) !important;} /* Makes logo at the bottom of pages dark */
.newItemBadge.newItems__some{border: none !important;} /* Removes ugly border from notification icon alert (1/2) */
.newItemBadge{width: 120% !important; height: 120% !important;} /* Removes ugly border from notification icon alert (2/2) */
.dashbox__titleLine{color: #fff !important;} /* Fixes dark text in dashbox (1/2) */
.dashbox__bodyLine{color: #ccc !important;} /* Fixes dark text in dashbox (2/2) */
.truncatedUserDescription.m-overflow.m-collapsed .truncatedUserDescription__wrapper::after{background: linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.1)) !important;} /* Gradient in truncated user description */
.visualSound__wrapper {background-color: #161719 !important;} /* Old style album layout interact area */
.readMoreTile__countWrapper{background-color: #e6e6e6 !important;} /* Fixes blur behind View all button as the invert filter breaks it */
.sc-button-small{font-weight: 500 !important;} /* Make font on small buttons thicker, or its too thin */
.callout__bubble{background-color: #292929 !important;} /* Fixes informational pop-ups shown to new users (1/2) */
.callout__bubble::before{background-color: black !important;} /* Fixes informational pop-ups shown to new users (2/2) */
.quotaMeterWrapper{background-color: unset !important;} /* Fixes free upload limit background */
.compactTrackList__moreLink:focus, .compactTrackList__moreLink:hover{background-color: black !important; color: white !important} /* Fixes stream playlist expand btn */
.commentFormDisabled{background-color: black !important;} /* Fixes background of Comments Disabled box */
.streamHTUpsell{background-color: #292929 !important;} /* In-stream banners */
.emptyNetworkPage__image{filter: invert(80%) !important;} /* Fix empty profile page */
.sc-font-body{font-weight: 500 !important;} /* Make body font slightly thicker for readability */
.featuredProfiles__item h3{filter: invert(100%) !important;} /* Fix featured profiles text 1/2 */
.featuredProfiles__list .sc-status-icon{filter: invert(100) !important;} /* Fix featured profiles text 2/2 */
.sc-button-delete::before{filter: invert(100%) !important;} /* Fix delete playlist button */
.sc-button-small.sc-button-lightfg:before{filter: unset !important;} /* Fix playlist preview song buttons */
.banner{background-color: #555555 !important;} /* Fixes banner and makes it compatible with the text */
.insightsSidebarModule__title{filter: invert(100%) !important;} /* Fix artist insight text*/
.sc-classic .keyboardShortcuts__shortcutsGroup>dl>dt>kbd>kbd {background: #222222 !important; } /* Removing the white background in the "Keyboard Shortcuts" page*/
.image__whiteOutline .image__full {border: 2px solid #161719 !important;} /* Removing the white borders from avatars in the stream page*/
.sc-classic .artistShortcutTile__badge {border: 2px solid #161719 !important;} /* Removing the white borders from the orange icon near the "Latest from people you know" header*/
.whoToFollowModule .sidebarHeader__title {white-space: nowrap; display: grid; grid-template-columns: auto 1fr;} /* Forbid who to follow module title to wrap. */
.whoToFollowModule .sidebarHeader__actualTitle {overflow: hidden; text-overflow: ellipsis;} /* Hide who to follow module title overflow. */
.whoToFollowModule .sidebarHeader__more {white-space: nowrap} /* Forbid who to follow module reload text to wrap. */
.sc-classic .listenArtistInfo__report .reportCopyright, .sc-classic .listenArtistInfo__report .reportNea {margin-top: 14px !important; filter: none !important;} /* Cancelling the filter property that makes the "Report" button white*/
.sc-classic .profileMenu .headerMenu__link{background: #242424;color: white;} /* User menu dropdown colors */
.sc-classic .m-light .headerMenu__link, .sc-classic .m-light .headerMenu__link:focus, .sc-classic .m-light .headerMenu__link:hover {color: black !important} /* Dropdown font color */
.sc-classic .profileMenu .headerMenu__link {color: white !important;} /* User menu dropdown text */
.sc-classic .profileMenu .headerMenu__link:after {filter: invert(1)} /* User menu dropdown icons */
.sc-classic .profileMenu:hover .headerMenu__link:hover{background: white;color: black;} /* Invert the user menu dropdown colors on hover */
.sc-classic .profileMenu:hover .headerMenu__link:hover .sc-classic .profileMenu .headerMenu__link:after{filter: none !important} /*  */
.sc-classic .headerMenu.m-light {background-color: #272727 !important;border:2px solid #242424 !important} /* User menu dropwdown border  */
.sc-classic .dropdownContent__container {filter:invert(1) hue-rotate(188deg)}
.sc-classic .notificationBadge.m-small .notificationBadge__main, .sc-classic .notificationBadge.m-small .notificationBadge__side {filter: invert(1) hue-rotate(172deg)}
.sc-classic .dropdownContent__header h2{filter: invert(1);}
.sc-classic .dropdownContent__footerLink {filter:brightness(1) !important}
.sc-classic .notificationBadge__main{color:white}
.notificationBadge__main>span {color: #b6b6b6}
.sc-classic .m-light .headerMenu__list {border:none !important}
.sc-classic .m-light .headerMenu__link, .sc-classic .m-light .headerMenu__link:focus, .sc-classic .m-light .headerMenu__link:hover {color: white !important;}
.sc-classic .headerMenu .m-light{background-color: #242424 !important;border: 1px solid grey !important;border-top: 0px !important}
.sc-classic .compactTrackList {border: none !important}
.sc-border-light-right{border-right: 1px solid #2b2b2b !important} /* vertical and horizontal lines dividing the app */
.sc-border-light-bottom {border-bottom: 1px solid #323232 !important} /* lists tracks border */
a.sc-link-light {border: none !important} /* lists tracks border */
.sc-classic .compactTrackListItem__number, .sc-classic .compactTrackListItem__trackTitle{color:#b2b2b2 !important} /* list track number */
::-webkit-scrollbar { width: 9px !important; height: 9px !important; } /* scrollbar */
::-webkit-scrollbar-track { background-color: #414141 !important; } /* scrollbar */
::-webkit-scrollbar-thumb { background-color: #272727 !important; border-radius: 14px !important; } /* scrollbar */
::-webkit-scrollbar-thumb:hover { background-color: #1b1b1b !important; } /* scrollbar */
.commentItem__body, .commentItem__replyButton, .commentItem__usernameLink {color: #c3c3c3 !important;} /*Fixed black text in comments to white*/

:root {color-scheme: dark;}`
