"use strict"


module.exports = function(RED) {

    // The node .js file defines the runtime behavior of the node.

    function MediapipeNode(config) {

        function HTML() {
            const html = String.raw`
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="utf-8">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
                    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js" crossorigin="anonymous"></script>
                    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" crossorigin="anonymous"></script>
                    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js" crossorigin="anonymous"></script>
                    <script src="https://cdn.socket.io/4.1.2/socket.io.min.js" integrity="sha384-toS6mmwu70G0fw54EGlWWeA4z3dyJ+dlXBtSURSKN4vyRFOcxd3Bzjj/AoOwY+Rg" crossorigin="anonymous"></script>

                    <style>
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                
                    th,
                    td {
                        border: 1px solid rgb(216, 216, 216);
                        padding: 3px;
                    }
                
                    .tooltip {
                        position: relative;
                        display: inline-block;
                    }
                
                    .tooltip .tooltip-content {
                        visibility: hidden;
                        background-color: rgba(255, 255, 255, 0.8);
                        color: black;
                        text-align: center;
                        position: absolute;
                        top: 3px;
                        left: 3px;
                        padding-left: 15px;
                        padding-right: 15px;
                        margin-top: 0px;
                        border-radius: 10px;
                        z-index: 1;
                    }
                
                    .tooltip:hover .tooltip-content {
                        visibility: visible;
                    }
                
                    #regist-btn {
                        background-color: #B2A1F4;
                        border: 1px solid grey;
                        border-left: none;
                        height: 21px;
                        color: white;
                    }
                
                    #regist-btn:hover {
                        background-color: #7557f0;
                        cursor: pointer;
                    }
                    </style>
                </head>
                
                <body>
                    <div align="center" style="min-height: 800px;">
                        <h1>Pose Detection Page</h1>
                        <div style="display: inline-block;" align="center" class="tooltip">
                        <video class="input_video" width="600px" height="340px" crossorigin="anonymous"
                            style="border:3px solid grey"></video><br>
                        <div class="tooltip-content">
                            <p>Your Camera</p>
                        </div>
                        </div>
                        <div style="display: inline-block;" align="center" class="tooltip">
                        <canvas class="output_canvas" width="600px" height="340px" style="border:3px solid #B2A1F4"></canvas><br>
                        <div class="tooltip-content">
                            <p>Tracking your Pose</p>
                        </div>
                        </div>
                        <div>
                        <br>
                        <select id="secondTimer">
                            <option value="0" selected>Now</option>
                            <option value="1">1s Timer</option>
                            <option value="2">2s Timer</option>
                            <option value="3">3s Timer</option>
                        </select>
                        <input id="pose-motion-name" type="text" placeholder="Motion Pose Name"><button id="regist-btn">Regist</button>
                        </div>
                        <div id="result-div" style="display: none;">
                        <p id="motion-result-message"></p>
                        <canvas class="capture_canvas" width="480px" height="270px" style="border:1px solid black"></canvas>
                        <div id="motion-result-keypoint"></div>
                        </div>
                    </div>
                    <hr>
                    <div align="center">
                        <a href="https://github.com/5FNSaaS">5FNSaaS</a>
                    </div>
                </body>
            </html>
            
            <script type="module">
            // ??????????????? ???????????? ???????????? ??????????????? ????????????????????? ?????? ??????
            // ??????????????? ???????????? ??? ????????? ????????? Loop??? ???????????????. (??? ????????? ????????? ??????????????? 10fps ?????? 0.1???)
            // ??? ????????? ????????? ????????? ????????? ????????? ????????? ???????????? ????????? ????????? ???????????? ??????????????????.
            // ?????? ?????? : https://stackoverflow.com/questions/44156528/canvas-doesnt-repaint-when-tab-inactive-backgrounded-for-recording-webgl


            // ????????? ?????? ??????
            function startDetect(renderFunc) {
                // ????????? ????????? ????????? ????????????.
                // (Loop ?????? ????????? ?????? ???????????? ?????? ??????, ???????????? ????????? ?????? ?????????????????? ??????)
                var fps = 60
                var stopLoop = audioTimerLoop(renderFunc, 1000 / fps)
            }


            // ????????? ?????? Loop ?????????
            function audioTimerLoop(renderFunc, frequency) {
                var freq = frequency / 1000  // AudioContext??? second ??????
                var aCtx = new AudioContext()
                var silence = aCtx.createGain()
                silence.gain.value = 0
                silence.connect(aCtx.destination)  // ????????? ?????? ????????? (??????)

                onOSCend()

                var stopped = false  // loop??? ????????? ?????? flag
                async function onOSCend() {
                    // ????????? ????????? (?????????)
                    await renderFunc()

                    // loop ??????
                    var osc = aCtx.createOscillator()
                    osc.onended = onOSCend  // loop??? ?????? ??????
                    osc.connect(silence)
                    osc.start()  // ?????? ??????
                    osc.stop(aCtx.currentTime + freq)  // ??? ????????? ?????? ??????
                    
                    // loop ??????
                    if (stopped) {
                        osc.onended = function () {
                            aCtx.close()
                            return
                        }
                    }
                }
                // loop??? ???????????? ?????? ????????? ????????????.
                return function() {
                    stopped = true
                }
            }


            /* motion regist timer */
            const timerSecond = document.getElementById("secondTimer");
            var second = timerSecond.options[timerSecond.selectedIndex].value;
            var poseData = null;
            var poseName = null;


            document.getElementById("secondTimer").addEventListener('change', () => {
                second = timerSecond.options[timerSecond.selectedIndex].value;
                console.log(second);
            })


            /* motion name empty check */
            var poseMotionName = document.getElementById("pose-motion-name");
            document.getElementById("regist-btn").addEventListener('click', () => {
                if (poseMotionName.value === "" || poseMotionName.value === undefined) {
                document.getElementById("motion-result-message").style.color = "red";
                document.getElementById("motion-result-message").textContent = "[Fail] Invalid Motion-Name";
                document.getElementsByClassName("capture_canvas")[0].style.display = "none";
                document.getElementById("result-div").style.display = "block";
                }
                else {
                onCapture(poseMotionName.value);
                }

                document.getElementById("pose-motion-name").value = "";
            })


            // DOM ????????????
            const videoElement = document.getElementsByClassName('input_video')[0]
            const canvasElement = document.getElementsByClassName('output_canvas')[0]
            const captureElement = document.getElementsByClassName('capture_canvas')[0];
            const canvasCtx = canvasElement.getContext('2d')
            const captureCtx = captureElement.getContext('2d');


            // Detection ????????? ????????? ????????? ???????????? ??????
            const dataWebSocket = new WebSocket('ws://localhost:1880/ws/data')


            /* visualize and transmit registered data  */
            function onCapture(motionName) {
                setTimeout((motionName) => {
                captureCtx.drawImage(canvasElement, 0, 0, captureElement.width, captureElement.height);
                var detail = "";
                const fixed = 5;

                detail += "<table style='display:inline;margin:0px 5px;'>";
                detail += "<caption>Estimated Pose</caption>";
                detail += "<tr><th></th><th>x</th><th>y</th><th>z</th><th>visibility</th></tr>";
                for (let idx = 0; idx < poseData.poseLandmarks.length; idx++) {
                    detail += "<tr>";
                    detail += "<td align='center'>" + idx + "</td>";
                    detail += "<td>" + poseData.poseLandmarks[idx].x.toFixed(fixed) + "</td>"
                    detail += "<td>" + poseData.poseLandmarks[idx].y.toFixed(fixed) + "</td>"
                    detail += "<td>" + poseData.poseLandmarks[idx].z.toFixed(fixed) + "</td>"
                    detail += "<td>" + poseData.poseLandmarks[idx].z.toFixed(fixed) + "</td>"
                    detail += "</tr>";
                }
                detail += "</table>";

                document.getElementById("motion-result-keypoint").innerHTML = '<br><b>' + motionName + "</b> Motion Detail <br>" + detail;
                document.getElementById("motion-result-message").style.color = "green";
                document.getElementById("motion-result-message").textContent = "Regist Success! You can used [" + motionName + "] motion";
                document.getElementsByClassName("capture_canvas")[0].style.display = "block";
                document.getElementById("pose-motion-name").value = "";
                document.getElementById("result-div").style.display = "block";


                poseData.regist = true;
                poseData.poseName = motionName;
                dataWebSocket.send(JSON.stringify(poseData));
                }, document.getElementById("secondTimer").value * 1000, motionName);
            }


            // ????????? ?????? ?????? ???????????? ??????
            let urlCreator
            let mirrorSocket
            const isMirror = ${config.isMirror}
            if (isMirror) {
                const mirrorPort = ${config.mirrorPort}
                urlCreator = window.URL || window.webkitURL
                mirrorSocket = io('http://localhost:' + mirrorPort)
                mirrorSocket.on("connect", () => {
                    console.log("connection server")
                    mirrorSocket.emit("echo", "echo from mediapipe")
                })
            }


            // ???????????? Pose Detection ????????? ??????????????? ??????
            function onResults(results) {
                // ??? ????????? ??????
                canvasCtx.save()
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height)
                
                // ???????????? ????????? ?????? ??????
                canvasCtx.globalCompositeOperation = 'destination-atop'
                canvasCtx.drawImage(
                    results.image, 0, 0, canvasElement.width, canvasElement.height)
                
                // ???????????? ????????? ???????????? ??????
                canvasCtx.globalCompositeOperation = 'source-over';
                drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
                    { color: '#f2d6ae', lineWidth: 5 });
                drawLandmarks(canvasCtx, results.poseLandmarks,
                    { color: '#b2a1f4', lineWidth: 1 });
                canvasCtx.restore()
                
                // ???????????? ????????? ??????????????? ??????
                if (results.poseLandmarks) {
                    if (dataWebSocket.readyState === 1) {
                        results.regist = false;
                        results.poseName = poseName;
                        dataWebSocket.send(JSON.stringify(results))

                        poseData = results;
                        poseName = null;
                    }
                }
                
                // ????????? ???????????? ??????????????? ????????? ????????? ?????? (?????? ?????? ???????????????)
                // https://github.com/Infocatcher/Right_Links/issues/25
                // https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
                if (isMirror && mirrorSocket.connected) {
                    canvasElement.toBlob(function (blob) {
                        const imageUrl = urlCreator.createObjectURL(blob)
                        mirrorSocket.emit('video', imageUrl)
                    }, 'image/webp')
                }
            }


            // Mediapipe??? Pose ???????????? ??????
            const pose = new Pose({locateFile: (file) => {
                return 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/' + file
            }})


            // Pose ???????????? ??????
            pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                enableSegmentation: true,
                smoothSegmentation: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            })
            pose.onResults(onResults)


            // ????????? ?????? (?????????)
            async function render() {
                await pose.send({ image: videoElement })
            }


            // ????????? ?????? ?????? ??? Detection ??????
            const mediaConstraints = {
                audio: false, // ?????? ??????????????? ?????? 'true'??? ????????? ???
                video: { width: 1280, height: 720 }
            }
            navigator.mediaDevices.getUserMedia(mediaConstraints)
                .then(stream => {
                    videoElement.srcObject = stream
                    videoElement.oncanplay = function(e) {
                        videoElement.play()
                            .then(() => {
                                startDetect(render)
                            })
                    }
                })
                .catch(err => {
                    console.log(err)
                })
            </script>
            `
            return html
        }

        RED.nodes.createNode(this, config)
        
        // listener to receive messages from the up-stream nodes in a flow.
        this.on('input', (msg, send, done) => {
            msg.payload = HTML()

            // send??? done??? 1.0 ?????? ????????? ????????? ??????
            // 0.x ???????????? ??????????????? ????????? ???????????? ???????????? ???
            if (done) {
                done()
            }
        
            // ????????? ?????? ?????? ????????? ???????????? ?????? ??? (0.x ?????? ??????)
            send = send || function() { this.send.apply(this, arguments )}
            send(msg)
        })
    
        // ????????? ???????????? ?????? ???
        this.send({ payload: 'this is message from MediapipeNode' })
    
        // ?????? ???????????? ????????????, ????????? ???????????? ???????????????.
        // ??? ????????? ??????????????? ???????????? ?????? ????????? ???????????? ?????? ?????????.
        this.on('close', function() {
            // do something
        })
    }
    RED.nodes.registerType("mediapipe", MediapipeNode)
}

