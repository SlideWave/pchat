var lastTimestamp = 0;
var pollRate = 1000;
var alertTimeoutId = null;
var focused = true;
var title = document.title;
var maxDisplayed = 100;
var pollTimeoutHandle = null;
var partnerIsActive = true;
var lastPartnerCheckin = 0;
var lastActivityCheck = 0;

var CHAT_TYPE_IM = 0;

var CHANGE_NONE = 0;
var CHANGE_ACTIVE = 1;
var CHANGE_INACTIVE = 2;

window.onfocus = function () {
    if (alertTimeoutId != null) {
        clearInterval(alertTimeoutId);
        alertTimeoutId = null;
    }

    document.title = title;
    focused = true;
}

window.onblur = function() {
    focused = false;
}

function doNewMessageAlert() {
    var msg = "New Message";
    var timeoutId;
    var blink = function() { document.title = document.title == msg ? title : msg; };
    if (!alertTimeoutId && !focused) {
        alertTimeoutId = setInterval(blink, 1000);
    }
}

function updateChatTimes() {
    //run though all the chat messages in the DOM and
    //update the "posted X hrs/days/etc ago" labels
    $(".chat-body .post-date span").each(function(index, elem) {
        var date = moment($(elem).attr('data-date'), 'x');
        var posted = moment.duration(date.diff(moment())).humanize();

        $(elem).html(posted);
    });
}

function pruneOldMessages() {
    //run though all the chat messages in the DOM and
    //prune old messages that are at the top
    var len = $(".chatmessage").length;
    var toRemove = len - maxDisplayed;

    if (toRemove > 0) {
        $(".chatmessage").each(function(index, elem) {
            if (toRemove-- > 0) {
                elem.remove();
                return true;
            } else {
                return false;
            }
        });
    }


}

function showProfileImage(image) {
    bootbox.alert("<img src='" + image + "' style='width: 100%'>", function() {
    });
}

function showMediaImage(image) {
    bootbox.alert("<img src='" + image + "' style='width: 100%'>", function() {
    });
}

function generateChatItemId(conversationId, timestamp, userId) {
    return conversationId + timestamp.toString() + userId;
}

function addToChatBox(messages) {
    var tzoff = new Date().getTimezoneOffset();

    for (var i = 0, len=messages.length; i < len; i++) {
        var msg = messages[i];
        if (!msg.surrgate && msg.timestamp <= checkpoint) break;

        var liClass = 'left';
        var spanClass = 'pull-left';
        var smallClass = 'pull-right';
        var strongClass = '';

        if (msg.userId == userid) {
            liClass = 'right';
            spanClass = 'pull-right';
            smallClass = '';
            strongClass = 'pull-right ';
        }

        var localTimePostedOn = moment(msg.timestamp).zone(tzoff);
        var posted = moment.duration(localTimePostedOn.diff(moment())).humanize();

        var pimage;

        if (msg.user.profileImage != null) {
            pimage = msg.user.profileImage.slice(0, -4) + "-t.jpg";
        } else {
            pimage = "/images/blank.png";
        }

        var id = generateChatItemId(conversationId, msg.timestamp, msg.userId);

        //check for and remove the surrogate if it exists
        $("#" + id).remove();

        var body;
        if (msg.media != null) {
            var mimage = msg.media.slice(0, -4) + "-t.jpg";
            body = '<a href="#" class="media"><img src="' + mimage + '"></a>';
        } else {
            body = '<p>' + html_sanitize(msg.message) + '</p>';
        }

        $("ul.chat").append(
            '<li class="' + liClass + ' clearfix chatmessage" id="' + id + '">' +
                '<span class="chat-img ' + spanClass + '">' +
                    '<a href="#">' +
                        '<img src="' + pimage +
                            '" alt="User Avatar" class="img-circle" style="width: 50px; height: 50px;" />' +
                    '</a>' +
                '</span>' +
                '<div class="chat-body clearfix">' +
                    '<div class="header">' +
                        '<strong class="' + strongClass + 'primary-font">' +
                            msg.user.username +
                        '</strong>' +
                        '<small class="' + smallClass + ' text-muted post-date">' +
                            '<i class="fa fa-clock-o fa-fw"></i><span data-date="' + localTimePostedOn + '"> ' + posted + '</span> ago' +
                        '</small>' +
                    '</div>' +
                    '<span id="' + id + '_message">' +
                        body +
                    '</span>' +
                '</div>' +
            '</li>'
        );

        (function (pimage) {
            $("#" + id + " > span.chat-img > a").click(function (evt) {
                if (pimage != null) {
                    showProfileImage(pimage);
                }
                evt.preventDefault();
            });
        })(msg.user.profileImage);


        if (msg.media) {
            (function (mimage) {
                $("#" + id + "_message > a").click(function (evt) {
                    if (pimage != null) {
                        showMediaImage(mimage);
                    }
                    evt.preventDefault();
                });
            })(msg.media);
        } else {
            $("#" + id + "_message").linkify();
            if (msg.surrogate) {
                //make it grey
                $("#" + id + "_message").css("color", "#cccccc");
            }
        }

        if (!msg.surrogate) {
            lastTimestamp = msg.timestamp;
        }
    }

    if (messages.length > 0) {
        //something was added, scroll to the bottom
        document.getElementById('chat-body').scrollTop = 99999;
        //also alert
        doNewMessageAlert();
    }

}

function getChatSinceLastCheck(completedCallback) {
    var cid = conversationId;

    $.ajax({
        cache: false,
        type: "GET",
        dataType: "json",
        url: "/chat/since/" + cid + "/" + lastTimestamp,
        contentType: "application/json",
        timeout: 10000,
        success:
            function(data) {
                data.surrogate = false;
                addToChatBox(data);
            },

        complete:
            function(xhr, status) {
                completedCallback();
            }
    });
}

function postSurrogate(text, cid) {
    var ts = Date.now();

    addToChatBox(
        [{
            timestamp: ts,
            userId: userid,
            user: {username: appUserName},
            message: text,
            surrogate: true
        }]
    );

    return generateChatItemId(conversationId, ts, userid);
}

function sendChat() {
    var text = $("#btn-input").val();
    if (text.trim() == '') return;

    $("#btn-input").val('');
    var cid = conversationId;

    //first, post up a surrogate chat message so that the
    //message post delay isn't jarring to the user
    var surrogateStamp = postSurrogate(text, cid);

    $.ajax({
        type: "POST",
        dataType: "json",
        url: "/chat/add",
        contentType: "application/json",
        data: JSON.stringify({"chatText": text, "conversationId": cid}),
        success:
            function(data) {
                var itemId = generateChatItemId(conversationId, data.timestamp,
                    userid);

                //race condition, we may have already been pulling new messages
                //when we started this post. if that is the case, we might
                //already have this message in our list, check for this
                //condition
                if ($("#" + itemId).length) {
                    //we already have the new message in our list.
                    //delete the surrogate
                    $("#" + surrogateStamp).remove();

                } else {
                    //update the surrogate id
                    $("#" + surrogateStamp).attr("id", itemId);

                    //once we have posted, schedule an immediate pull
                    //to retrieve our message right away
                    if (pollTimeoutHandle != null) {
                        clearTimeout(pollTimeoutHandle);
                        pollTimeoutHandle = setTimeout(chatTimer, 1);
                    }
                }
            },
        error:
            function(xhr, textStatus, error) {
                notifyChatEvent("Message failed to send");
            }
    });
}

/**
 * If we're in a 1 on 1 IM, this function checks the active
 * times for the person we're in an IM with, and reports any
 * changes in activity status
 */
function checkForActivityChange(force, callback) {
    if (chatType == CHAT_TYPE_IM) {
        var changeType = CHANGE_NONE;

        //retrieve the user's last active time once every
        //30 seconds
        var ACTIVITY_UPDATE_FREQUENCY = 30000;
        if (force || Date.now() - lastActivityCheck >= ACTIVITY_UPDATE_FREQUENCY) {
            $.ajax({
                cache: false,
                type: "GET",
                dataType: "json",
                url: "/user/lastseen/" + partnerId,
                contentType: "application/json",

                success:
                    function(data) {
                        var tzoff = new Date().getTimezoneOffset();
                        var localTimePostedOn = moment(data.lastseen).zone(tzoff);
                        var activeDifference = moment.duration(localTimePostedOn.diff(moment()));
                        var posted = activeDifference.humanize();

                        var liClass = 'right';
                        var spanClass = 'pull-right';
                        var smallClass = '';
                        var strongClass = 'pull-right';

                        var chageDesc;
                        if (force) {
                            changeDesc = data.name + " is active ";
                        }

                        var MINUTES_TO_IDLE = 5;

                        if (partnerIsActive && -activeDifference.asMinutes() > MINUTES_TO_IDLE) {
                            changeType = CHANGE_INACTIVE;
                            changeDesc = data.name + " went idle ";
                            partnerIsActive = false;
                        } else if (!partnerIsActive && -activeDifference.asMinutes() < MINUTES_TO_IDLE) {
                            changeType = CHANGE_ACTIVE;
                            changeDesc = data.name + " is active ";
                            partnerIsActive = true;
                        } else if (!partnerIsActive && lastPartnerCheckin != data.lastseen) {
                            //anytime there is a period where someone goes idle
                            //again, but we missed them being active
                            changeType = CHANGE_INACTIVE;
                            changeDesc = data.name + " went idle ";
                            partnerIsActive = false;
                        } else {
                            changeType = CHANGE_NONE;
                        }

                        lastPartnerCheckin = data.lastseen;
                        lastActivityCheck = Date.now();

                        if (changeType != CHANGE_NONE || force) {
                            $("ul.chat").append(
                                '<li class="' + liClass + ' clearfix chatmessage">' +
                                    '<div class="chat-body clearfix">' +
                                        '<div class="header">' +
                                            '<small class="' + smallClass + ' text-muted post-date">' +
                                                '<i class="fa fa-clock-o fa-fw"></i> ' + changeDesc + '<span data-date="' + localTimePostedOn + '">' + posted + '</span> ago' +
                                            '</small>' +
                                        '</div>' +
                                    '</div>' +
                                '</li>'
                            );

                            //something was added, scroll to the bottom
                            document.getElementById('chat-body').scrollTop = 99999;
                        }
                    },

                complete:
                    function (a,b) {
                        callback(changeType);
                    }
            });
        } else {
            callback(changeType);
        }

    } else {
        callback(changeType);
    }
}

function chatRefresh(callback) {
    pollTimeoutHandle = null;

    getChatSinceLastCheck(function() {
        pruneOldMessages();
        updateChatTimes();

        checkForActivityChange(false,
            function (changeType) {
                callback();
            }
        );

    });
}

function chatTimer() {
    chatRefresh(function() {
        if (pollTimeoutHandle == null) {
            pollTimeoutHandle = setTimeout(chatTimer, pollRate);
        }
    });
}

function leaveChat() {
    var cid = conversationId;

    $.ajax({
        type: "POST",
        dataType: "json",
        url: "/chat/leave",
        contentType: "application/json",
        data: JSON.stringify({"conversationId": cid}),
        success:
        function(data) {
            window.location = "/";
        }
    });
}

function chatClear() {
    //run though all the chat messages in the DOM and
    //remove them all
    $(".chatmessage").each(function(index, elem) {
        elem.remove();
    });
}

function notifyChatEvent(event) {
    var liClass = 'right';
    var spanClass = 'pull-right';
    var smallClass = '';
    var strongClass = 'pull-right';
    var timeNow = moment();

    $("ul.chat").append(
        '<li class="' + liClass + ' clearfix chatmessage">' +
            '<div class="chat-body clearfix">' +
                '<div class="header">' +
                    '<small class="' + smallClass + ' text-muted post-date">' +
                        '<i class="fa fa-commenting-o fa-fw"></i> ' + event + ' <span data-date="' + timeNow + '">0 seconds</span> ago' +
                    '</small>' +
                '</div>' +
            '</div>' +
        '</li>'
    );

    //something was added, scroll to the bottom
    document.getElementById('chat-body').scrollTop = 99999;
}

function notifyNewChat(chat) {
    notifyChatEvent("New chat started: " + chat.title);
}

function notifyChatUpdated(chat) {
    if (chat.chatData.conversationId != conversationId) {
        notifyChatEvent("New message in " + chat.chatData.title);
    }
}

$(document).ready(function() {
    var cid = conversationId;

    //subscribe to notifications from the chat monitor
    ChatMonitor.onNewChatCreated(notifyNewChat);
    ChatMonitor.onChatUpdated(notifyChatUpdated);

    //grab the most recent chat messages
    $.ajax({
        cache: false,
        type: "GET",
        dataType: "json",
        url: "/chat/recent/" + cid,
        contentType: "application/json",
        success:
            function(data) {
                addToChatBox(data);
                if (lastTimestamp < checkpoint) {
                    lastTimestamp = checkpoint;
                }
            },

        complete:
            function (a,b) {
                checkForActivityChange(true,
                    function (changeType) {
                        pollTimeoutHandle = setTimeout(chatTimer, pollRate);
                    }
                );
            }
    });

    $("#btn-chat").click(function(evt) {
        sendChat();
    });

    $("#btn-input").keypress(function (e) {
        var key = e.which;
        if(key == 13)  { //enter key
            sendChat();
            return false;
        }
    });

    $("#chat-clear").click(function (e) {
        checkpoint = lastTimestamp;
        chatClear();

        $.ajax({
            type: "POST",
            dataType: "json",
            url: "/chat/checkpoint",
            contentType: "application/json",
            data: JSON.stringify({"conversationId": cid, "checkpoint": checkpoint}),
            success:
            function(data) {

            }
        });

        e.preventDefault();
    });

    $("#chat-leave").click(function (e) {
        leaveChat();
        e.preventDefault();
    });

    $("#btn-media").click(function(e) {
        $("#addMediaModal").modal();
    });

    $("#media-cancel").click(function(e) {
        $("#imagefile").val('');
        submissionDropzone.removeAllFiles();
    });

    $("#media-send").click(function(e) {
        var file = $("#imagefile").val();
        $("#imagefile").val('');

        submissionDropzone.removeAllFiles();

        $.ajax({
            type: "POST",
            dataType: "json",
            url: "/chat/add",
            contentType: "application/json",
            data: JSON.stringify({"media": file, "conversationId": cid}),
            success:
                function(data) {
                },

            error:
                function(xhr, textStatus, error) {
                    notifyChatEvent("Message failed to send");
                }
        });
    });
});
