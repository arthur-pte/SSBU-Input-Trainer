"use strict";

// -- -- -- -- -- -- --       -- -- -- --       -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- -- CONSTANTS AND VARIABLES -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- --       -- -- -- --       -- -- -- -- -- -- -- \\
// HTML elements
let gamepadInfo = document.getElementById("gamepad-info");
let stick = document.getElementById("left-stick");
let leftVis = document.getElementById("left-vis");
let leftDeadZone = document.getElementById("left-dz");
let angleInfo = document.getElementById("angle-info");

// Constants
const frameLength = 1e3 / 60;
const audioPlayer = new Audio();
audioPlayer.volume = 0.05;
const sounds = {
    "sf_hadoken": "assets/sounds/sf_hadoken.mp3",
    "sf_shoryuken": "assets/sounds/sf_shoryuken.mp3",
    "ken_shoryuken": "assets/sounds/ken_shoryuken.wav"
};
const inputsOrder = {
    "hadoken_r": [7, 8, 1],
    "hadoken_L": [7, 6, 5],
    "shoryuken_r": [8, 7, 8],
    "shoryuken_l": [5, 7, 6],
    "shaku_r": [6, 7, 8, 1],
    "shaku_l": [8, 7, 6, 5]
};
const numAnnotation = ["RIGHT", "UP-RIGHT", "UP", "UP-LEFT", "LEFT", "DOWN-LEFT", "DOWN", "DOWN-RIGHT"];
const controllerSettings = { "A": 0, "B": 1, "L_stick": "0,1", "R_stick": "2,3", "L_trigger": 3, "R_trigger": 4, "Deadzone": 10 };
const bufferSize = 50;
const buffer = new Array(bufferSize);
buffer.fill({ direction: -1, time: window.performance.now() });
buffer.push = function () {
    if (this.length >= bufferSize)
        this.shift();
    return Array.prototype.push.apply(this, arguments);
};

// Variables
let released = true;
let used = false;
let rAF;
let gui;


// -- -- -- -- -- -- --     -- -- --     -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- -- SETUP AND EVENTS -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- --     -- -- --     -- -- -- -- -- -- -- \\
// Requestion animation setup for every navigators
window.requestAnimationFrame = function (f) {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        function (f) {
            window.setTimeout(f, 1e3 / 60);
        };
}();

// Gamepad connected event 
window.addEventListener("gamepadconnected", () => {
    var gp = navigator.getGamepads()[0];
    gamepadInfo.style.display = "none";
    stick.style.display = "block";
    angleInfo.style.display = "block";

    gui = new dat.GUI({ name: "Controller settings" });
    gui.add(controllerSettings, "A", Array.from({ length: (gp.buttons.length + 1) }, (_, i) => i));
    gui.add(controllerSettings, "B", Array.from({ length: (gp.buttons.length + 1) }, (_, i) => i));
    gui.add(controllerSettings, "R_trigger", Array.from({ length: (gp.buttons.length + 1) }, (_, i) => i));
    gui.add(controllerSettings, "L_trigger", Array.from({ length: (gp.buttons.length + 1) }, (_, i) => i));
    gui.add(controllerSettings, "L_stick", Array.from({ length: (gp.axes.length + 1) / 2 }, (_, i) => [i * 2, i * 2 + 1]));
    gui.add(controllerSettings, "R_stick", Array.from({ length: (gp.axes.length + 1) / 2 }, (_, i) => [i * 2, i * 2 + 1]));
    gui.add(controllerSettings, "Deadzone", 0, 100);

    rAF = window.requestAnimationFrame(loop);
});

// Gamepad disconnected event 
window.addEventListener("gamepaddisconnected", () => {
    stick.style.display = "none";
    angleInfo.style.display = "none";
    gamepadInfo.style.display = "block";
    gamepadInfo.innerHTML = "Waiting for gamepad";
    gui.destroy();
    window.cancelAnimationFrame(rAF);
});


// -- -- -- -- -- -- --    --     -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- -- FUNCTIONS -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- --    --     -- -- -- -- -- -- -- \\
const checkThreeMotionInput = (bufferCopy, inputsOrder) => {
    let indexThird = bufferCopy.findIndex((element) => element.direction == inputsOrder[2]);
    let indexSecond = bufferCopy.findIndex((element) => element.direction == inputsOrder[1]);
    let indexFirst = bufferCopy.slice(indexSecond).findIndex((element) => element.direction == inputsOrder[0]);

    // sliced(indexSecond) changed the order of the buffer
    indexFirst += indexSecond;

    if (indexThird == -1 || indexSecond == -1 || (indexFirst - indexSecond) == -1 || indexThird > indexSecond || indexSecond > indexFirst || indexThird > indexFirst) {
        console.log(`Failed : You must input ${numAnnotation[inputsOrder[0] - 1]} -> ${numAnnotation[inputsOrder[1] - 1]} -> ${numAnnotation[inputsOrder[2] - 1]}`);
        return false;
    }

    if ((bufferCopy[indexSecond].time - bufferCopy[indexFirst].time) > (10 * frameLength)) {
        console.log(`Failed : Too much time on ${numAnnotation[inputsOrder[1] - 1]}`);
        return false;
    } else if ((bufferCopy[0].time - bufferCopy[indexSecond].time) > (11 * frameLength)) {
        console.log("Failed : Pressed A too late");
        return false;
    }

    // Add how much time A pressed

    return true;
};

const getAngle = (x, y) => {
    var radians = Math.atan2(-y, x);
    if (radians < 0) {
        radians += 2 * Math.PI;
    }
    var degrees = Math.abs(radians) * (180 / Math.PI);
    return (Math.round(degrees * 100) / 100);
};

const update = (timeStamp) => {
    // Check if any gamepad is connected
    let gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads : []);
    if (!gamepads)
        return;

    let gp = gamepads[0];
    let leftAngle = getAngle(gp.axes[controllerSettings.L_stick[0]], gp.axes[controllerSettings.L_stick[2]]);
    let leftDistance = (Math.sqrt((gp.axes[controllerSettings.L_stick[0]] ** 2 + gp.axes[controllerSettings.L_stick[2]] ** 2)) * 100).toFixed(2);

    // Show left analog stick and deadzone
    leftDeadZone.style.width = controllerSettings.Deadzone + "%";
    leftDeadZone.style.height = controllerSettings.Deadzone + "%";
    leftVis.style.left = 50 + (gp.axes[controllerSettings.L_stick[0]] * 100) / 2 + "%";
    leftVis.style.top = 50 + (gp.axes[controllerSettings.L_stick[2]] * 100) / 2 + "%";

    // Buffer "A" button push
    if (gp.buttons[controllerSettings.A].pressed == true) {
        buffer.push({ direction: 0, time: timeStamp });
        if (released == true && checkThreeMotionInput(buffer.slice().reverse(), inputsOrder.hadoken_r)) {
            console.log("GOOD INPUT");
            audioPlayer.src = sounds.ken_shoryuken;
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            // gp.vibrationActuator.playEffect("dual-rumble", {
            //     startDelay: 0,
            //     duration: 100,
            //     weakMagnitude: 0.2,
            //     strongMagnitude: 0.2,
            // });
        }

        // Clear the buffer 
        buffer.fill({ direction: -1, time: window.performance.now() });
        document.body.style.backgroundColor = "#222222";
        used = true;
        released = false;
    } else {
        document.body.style.backgroundColor = "black";
        released = true;
    }

    // Buffer left analog stick
    if (leftDistance > controllerSettings.Deadzone) {
        used = true;
        angleInfo.innerHTML = leftAngle + "°" + "<br>" + leftDistance + "%";
        let numDirection = 1 + (Math.round(leftAngle / 45) % 8);
        if (buffer.at(-1).direction != numDirection)
            buffer.push({ direction: numDirection, time: timeStamp });
    } else {
        used = false;
        angleInfo.innerHTML = "0.00°<br>0.00%";
    }

    // Adding empty input if no command inputted
    if (!used)
        buffer.push({ direction: -1, time: timeStamp });
};

// -- -- -- -- -- -- --    --     -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- -- MAIN LOOP -- -- -- -- -- -- -- \\
// -- -- -- -- -- -- --    --     -- -- -- -- -- -- -- \\
let previousTime = 0;
let deltaTime = 0;
let deltaError = 0;
const loop = (timeStamp) => {
    if (timeStamp < (previousTime + frameLength)) {
        rAF = window.requestAnimationFrame(loop);
        return;
    }

    // Compute the delta-time against the previous time
    deltaTime = timeStamp - previousTime;
    // Update the previous time
    previousTime = timeStamp;

    // Update the logic
    while (deltaTime >= frameLength) {
        update(timeStamp);
        deltaTime -= frameLength;
    }

    // Render here ?

    rAF = window.requestAnimationFrame(loop);
};