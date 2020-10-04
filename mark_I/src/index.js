/* globals */
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import URDFManipulator from '../../src/urdf-manipulator-element.js';


customElements.define('urdf-viewer', URDFManipulator);

const viewer = document.querySelector('urdf-viewer');

const sliderList = document.querySelector('#controls ul');
const controlsel = document.getElementById('controls');
const controlsToggle = document.getElementById('toggle-controls');
const animToggle = document.getElementById('do-animate');
const gallopToggle = document.getElementById('do-gallop');
const initToggle = document.getElementById('do-init');
const restToggle = document.getElementById('do-rest');
const drillToggle = document.getElementById('do-drill');

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 1 / DEG2RAD;
let sliders = {};
let gait_counter = 0;
let initial_pose = {
    motor_shoulder_FL: 0.0, motor_leg_FL: -0.88, foot_motor_FL: 1.3,
    motor_shoulder_FR: 0.0, motor_leg_FR: -0.88, foot_motor_FR: 1.3,
    motor_shoulder_RL: 0.0, motor_leg_RL: -0.88, foot_motor_RL: 1.3,
    motor_shoulder_RR: 0.0, motor_leg_RR: -0.88, foot_motor_RR: 1.3,
    motor_arm_m1: -1.57, motor_arm_m2: -1.57, motor_arm_m3: 0.0,
    motor_arm_m4: 0.0, motor_arm_m5: 1.57, motor_arm_m6: -1.57
};
let rest_pose = {
    motor_shoulder_FL: 0.0, motor_leg_FL: -1.57, foot_motor_FL: 3.14,
    motor_shoulder_FR: 0.0, motor_leg_FR: -1.57, foot_motor_FR: 3.14,
    motor_shoulder_RL: 0.0, motor_leg_RL: -1.57, foot_motor_RL: 3.14,
    motor_shoulder_RR: 0.0, motor_leg_RR: -1.57, foot_motor_RR: 3.14,
    motor_arm_m1: -1.57, motor_arm_m2: -1.57, motor_arm_m3: 0.0,
    motor_arm_m4: 0.0, motor_arm_m5: 1.57, motor_arm_m6: -1.57
};
let drill_pose = {
    motor_shoulder_FL: 0.0, motor_leg_FL: -1.57, foot_motor_FL: 3.14,
    motor_shoulder_FR: 0.0, motor_leg_FR: -1.57, foot_motor_FR: 3.14,
    motor_shoulder_RL: 0.0, motor_leg_RL: -1.57, foot_motor_RL: 3.14,
    motor_shoulder_RR: 0.0, motor_leg_RR: -1.57, foot_motor_RR: 3.14,
    motor_arm_m1: -1.57, motor_arm_m2: 1.57, motor_arm_m3: 0.0,
    motor_arm_m4: 0.0, motor_arm_m5: -1.57, motor_arm_m6: 0.0
};
var walk_json;
var gallop_json;
fetch('assets/gaits/walk.json').then(res => res.json()).then(data => walk_json = data);
fetch('assets/gaits/gallop.json').then(res => res.json()).then(data => gallop_json = data);

// Global Functions
const setColor = color => {

    document.body.style.backgroundColor = color;
    viewer.highlightColor = '#' + (new THREE.Color(0xffffff)).lerp(new THREE.Color(color), 0.35).getHexString();

};

controlsToggle.addEventListener('click', () => controlsel.classList.toggle('hidden'));

// watch for urdf changes
viewer.addEventListener('urdf-change', () => {

    Object
        .values(sliders)
        .forEach(sl => sl.remove());
    sliders = {};

});

viewer.addEventListener('angle-change', e => {
    if (viewer.robot.visible === true) {
        if (sliders[e.detail]) sliders[e.detail].update();
    }
});

viewer.addEventListener('joint-mouseover', e => {
    if (viewer.robot.visible === true) {
        const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
        if (j) j.setAttribute('robot-hovered', true);
    }
});

viewer.addEventListener('joint-mouseout', e => {

    const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
    if (j) j.removeAttribute('robot-hovered');

});

let originalNoAutoRecenter;
viewer.addEventListener('manipulate-start', e => {
    if (viewer.robot.visible === true) {
        const j = document.querySelector(`li[joint-name="${ e.detail }"]`);
        if (j) {
            j.scrollIntoView({ block: 'nearest' });
            window.scrollTo(0, 0);
        }

        originalNoAutoRecenter = viewer.noAutoRecenter;
        viewer.noAutoRecenter = true;
    }

});

viewer.addEventListener('manipulate-end', e => {

    viewer.noAutoRecenter = originalNoAutoRecenter;

});

// create the sliders
viewer.addEventListener('urdf-processed', () => {

    const r = viewer.robot;
    Object
        .keys(r.joints)
        .map(key => r.joints[key])
        .sort()
        .forEach(joint => {
            if (String(joint.name).includes("motor")) {
                const li = document.createElement('li');
                li.innerHTML =
                `
                <span title="${ joint.name }">${ String(joint.name).replace("motor_", "") }</span>
                <input type="range" value="0" step="0.0001"/>
                <input type="number" step="0.0001" />
                `;
                li.setAttribute('joint-type', joint.jointType);
                li.setAttribute('joint-name', joint.name);

                sliderList.appendChild(li);

                // update the joint display
                const slider = li.querySelector('input[type="range"]');
                const input = li.querySelector('input[type="number"]');
                li.update = () => {
                    let degVal = joint.angle;

                    if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
                        degVal *= RAD2DEG;
                    }

                    if (Math.abs(degVal) > 1) {
                        degVal = degVal.toFixed(1);
                    } else {
                        degVal = degVal.toPrecision(2);
                    }

                    input.value = parseFloat(degVal);

                    // directly input the value
                    slider.value = joint.angle;

                    if (viewer.ignoreLimits || joint.jointType === 'continuous') {
                        slider.min = -6.28;
                        slider.max = 6.28;

                        input.min = -6.28 * RAD2DEG;
                        input.max = 6.28 * RAD2DEG;
                    } else {
                        slider.min = joint.limit.lower;
                        slider.max = joint.limit.upper;

                        input.min = joint.limit.lower * RAD2DEG;
                        input.max = joint.limit.upper * RAD2DEG;
                    }
                };

                switch (joint.jointType) {

                    case 'continuous':
                    case 'prismatic':
                    case 'revolute':
                        break;
                    default:
                        li.update = () => {};
                        input.remove();
                        slider.remove();

                }

                slider.addEventListener('input', () => {
                    initToggle.classList.remove('checked');
                    restToggle.classList.remove('checked');
                    viewer.setAngle(joint.name, slider.value);
                    li.update();
                });

                input.addEventListener('change', () => {
                    viewer.setAngle(joint.name, input.value * DEG2RAD);
                    li.update();
                });

                li.update();

                sliders[joint.name] = li;
            }

        });

});

document.addEventListener('WebComponentsReady', () => {

    viewer.loadMeshFunc = (path, manager, done) => {

        const ext = path.split(/\./g).pop().toLowerCase();
        switch (ext) {

            case 'gltf':
            case 'glb':
                new GLTFLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err)
                );
                break;
            case 'obj':
                new OBJLoader(manager).load(
                    path,
                    result => done(result),
                    null,
                    err => done(null, err)
                );
                break;
            case 'dae':
                new ColladaLoader(manager).load(
                    path,
                    result => done(result.scene),
                    null,
                    err => done(null, err)
                );
                break;
            case 'stl':
                new STLLoader(manager).load(
                    path,
                    result => {
                        const material = new THREE.MeshPhongMaterial();
                        const mesh = new THREE.Mesh(result, material);
                        done(mesh);
                    },
                    null,
                    err => done(null, err)
                );
                break;

        }

    };

    document.querySelector('li[urdf]').dispatchEvent(new Event('click'));

});

// init 2D UI and animation
const walkGait = () => {
    if (viewer.robot.visible === false) {
        showModel();
    }
    if (!viewer.setAngle) return;
    setInitialPose();
    const r = viewer.robot;
    let count = 0;
    Object
        .keys(r.joints)
        .map(key => r.joints[key])
        .sort()
        .forEach(joint => {
            if (String(joint.name).includes("motor") && !String(joint.name).includes("arm")) {
                if (gait_counter in walk_json) {
                    viewer.setAngle(joint.name, walk_json[gait_counter]['signal'][count])
                    count += 1;
                    if (count > 17) {
                        count = 0;
                    } 
                }
                else {
                    gait_counter = 0;
                }
                
            }    
        });
    gait_counter += 1;
};

const gallopGait = () => {
    if (viewer.robot.visible === false) {
        showModel();
    }
    if (!viewer.setAngle) return;
    setInitialPose();

    const r = viewer.robot;
    let count = 0;
    Object
        .keys(r.joints)
        .map(key => r.joints[key])
        .sort()
        .forEach(joint => {
            if (String(joint.name).includes("motor") && !String(joint.name).includes("arm")) {
                if (gait_counter in gallop_json) {
                    viewer.setAngle(joint.name, gallop_json[gait_counter]['signal'][count])
                    count += 1;
                    if (count > 17) {
                        count = 0;
                    } 
                }
                else {
                    gait_counter = 0;
                }
                
            }    
        });
    gait_counter += 1;
};

const setInitialPose = () => {
    if (viewer.robot.visible === false) {
        showModel();
    }
    for (var joint in initial_pose) {
        viewer.setAngle(joint, initial_pose[joint]);
    }
};

const setRestPose = () => {
    if (viewer.robot.visible === false) {
        showModel();
    }
    for (var joint in rest_pose) {
        viewer.setAngle(joint, rest_pose[joint]);
    }
};

const setDrillPose = () => {
    if (viewer.robot.visible === false) {
        showModel();
    }
    for (var joint in drill_pose) {
        viewer.setAngle(joint, drill_pose[joint]);
    }
};

const updateLoop = () => {

    if (animToggle.classList.contains('checked')) {
        walkGait();
    }
    else if(gallopToggle.classList.contains('checked')) {
        gallopGait();
    }
    else if(initToggle.classList.contains('checked')) {
        setInitialPose();
    }
    else if(restToggle.classList.contains('checked')) {
        setRestPose();
    }
    else if(drillToggle.classList.contains('checked')) {
        setDrillPose();
    }

    requestAnimationFrame(updateLoop);

};

document.querySelectorAll('#urdf-options li[urdf]').forEach(el => {

    el.addEventListener('click', e => {

        const urdf = e.target.getAttribute('urdf');
        const color = e.target.getAttribute('color');

        viewer.up = '+Z';
        viewer.urdf = urdf;
        setColor(color);

    });

});

document.addEventListener('WebComponentsReady', () => {

    animToggle.addEventListener('click', () => { 
        animToggle.classList.toggle('checked');
        gallopToggle.classList.remove('checked');
        initToggle.classList.remove('checked');
        restToggle.classList.remove('checked');
        drillToggle.classList.remove('checked');
    });

    gallopToggle.addEventListener('click', () => {
        gallopToggle.classList.toggle('checked');
        animToggle.classList.remove('checked');
        initToggle.classList.remove('checked');
        restToggle.classList.remove('checked');
        drillToggle.classList.remove('checked');
    });

    initToggle.addEventListener('click', () => {
        initToggle.classList.toggle('checked');
        animToggle.classList.remove('checked');
        gallopToggle.classList.remove('checked');
        restToggle.classList.remove('checked');
        drillToggle.classList.remove('checked');
    });

    restToggle.addEventListener('click', () => {
        restToggle.classList.toggle('checked');
        animToggle.classList.remove('checked');
        gallopToggle.classList.remove('checked');
        initToggle.classList.remove('checked');
        drillToggle.classList.remove('checked');
    });

    drillToggle.addEventListener('click', () => {
        drillToggle.classList.toggle('checked');
        restToggle.classList.remove('checked');
        animToggle.classList.remove('checked');
        gallopToggle.classList.remove('checked');
        initToggle.classList.remove('checked');
    });

    // stop the animation if user tried to manipulate the model
    viewer.addEventListener('manipulate-start', e => {
        animToggle.classList.remove('checked');
        gallopToggle.classList.remove('checked');
        initToggle.classList.remove('checked');
        restToggle.classList.remove('checked');
        drillToggle.classList.remove('checked');
    });
    viewer.addEventListener('urdf-processed', e => setInitialPose());
    updateLoop();
    viewer.camera.position.set(-5.5, 3.5, 2.5);
    controlsel.classList.toggle('hidden');

});