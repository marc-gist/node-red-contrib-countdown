module.exports = function(RED) {
    "use strict";

    const isNumber = require('is-number');

    
    function countdown(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.config = config;

        // Local variables
        var ticker = null;
        var ticks = -1;
        var timeout = parseInt(node.config.timer);

        this.status({ fill: "red", shape: "dot", text: "Stopped: " + timeout });

        function runningMessage(ticks) {
            var m = "Running: " + ticks;
            if(node.config.minuteCounter) {
                m = m + " minute(s)";
            } else {
                m = m + " second(s)";
            }
            return m;
        }

        function startTimer() {
            timeout = timeout || parseInt(node.config.timer);
            ticks = timeout;

            // running status message
            node.status({
                fill: "green", shape: "dot", text: runningMessage(ticks)
            });

            // Timer Message
            var msg = {}
            msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStart, node.config.payloadTimerStartType, node); 
            if (node.config.topic !== '') {
                msg.topic = node.config.topic;
            }

            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStartType !== "nul") {
                node.send([msg, null]);
            }


            if (!ticker) {
                var secMinute = 1000;
                if(node.config.minuteCounter) {
                    secMinute = 1000 * 60;
                    node.warn("setting to minutes");
                }
                ticker = setInterval(function() { node.emit("TIX"); }, secMinute);
            }
        }

        function stopTimer(output=true) {
            node.status({
                fill: "red", shape: "dot", text: "Stopped: " + timeout
            });

            // Timer Message
            var msg = {}
            var cancel = false;
            if(output) {
                msg.payload = RED.util.evaluateNodeProperty(node.config.payloadTimerStop, node.config.payloadTimerStopType, node); 
                if (node.config.topic !== '') {
                    msg.topic = node.config.topic;
                }
            } else {
                msg = null;
                cancel = true;
            }
            
            
            var remainingTicksMsg = { "payload": ticks, "cancled": cancel };

            // only send stop msg if type is not equal "send nothing" option
            if (node.config.payloadTimerStopType == "nul") {
                node.send([null, remainingTicksMsg]);
            } else {
                node.send([msg, remainingTicksMsg]);
            }

            endTicker();
        }

        function endTicker() {
            if (ticker) {
                clearInterval(ticker);
                ticker = null;
            }

            ticks = -1;
        }

        node.on("TIX", function() {
            if (ticks > 1) {
                ticks--;

                var remainingTicksMsg = { "payload": ticks };
                node.send([null, remainingTicksMsg]);
        
                // update Running status message
                node.status({
                    fill: "green", shape: "dot", text: runningMessage(ticks)
                });

            } else if (ticks == 1){
                ticks = 0;
                stopTimer();

               

            } else {
                // Do nothing
            }
        });

        node.on("input", function (msg) {
            if (msg.topic === "control") {
                if (isNumber(msg.payload) && msg.payload > 1) {
                    timeout = Math.ceil(msg.payload);

                    if (ticker) {
                        // countdown is running
                        if (node.config.setTimeToNewWhileRunning) {
                            ticks = msg.payload;
                            node.status({
                                fill: "green", shape: "dot", text: "Running: "+ timeout
                            });
                        }
                    } else {
                        // countdown is stopped
                        if (node.config.startCountdownOnControlMessage) {
                            startTimer();
                        } else {
                            node.status({
                                fill: "red", shape: "dot", text: "Stopped: "+ timeout
                            });
                        }
             
                    }
                } else {
                    if(msg.payload === "cancel") {
                        stopTimer(false);
                    }
                    if(msg.payload === "reset") {
                        startTimer();
                    }
                }
            } else {
                if (msg.payload === false || msg.payload === 0) {
                    stopTimer();
                } else {
                    if (ticker) {
                        if (node.config.resetWhileRunning) {
                            endTicker();
                            startTimer();
                        }
                    } else {
                        startTimer();
                    }
                }
            }
        });

        node.on("close", function() {
            if (ticker) {
                clearInterval(ticker);
            }
        });
    }
    RED.nodes.registerType("countdown", countdown);
}
