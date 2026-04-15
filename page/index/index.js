const { createApp, ref, onMounted, onUnmounted } = Vue;

createApp({
    setup() {
        const isMobile = ref(false);
        let scene, camera, renderer;
        let cannon, cannonTube;
        let stars = [];
        let fishes = [];
        let fireworks = [];
        let trails = [];
        let ripples = [];
        let canFire = true;
        let mouseX = 0, mouseY = 0;
        let targetMouseX = 0, targetMouseY = 0;
        let audioContext;
        const maxParallax = 12;
        const blessingTexts = [
            '新年快乐', '万事如意', '身体健康', '阖家幸福', '事业有成',
            '学业进步', '爱情甜蜜', '财源广进', '步步高升', '心想事成',
            '平安喜乐', '福寿安康', '岁岁平安', '年年有余', '一帆风顺'
        ];
        const fishColors = [0xff6b6b, 0xfeca57, 0x48dbfb, 0xff9ff3, 0x54a0ff,
            0x5f27cd, 0x00d2d3, 0xff9f43, 0x1dd1a1, 0xf368e0
        ];

        function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        function playSound(type) {
            if (!audioContext) initAudio();
            
            if (type === 'launch') {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.4);
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
            } else if (type === 'explode') {
                const bufferSize = audioContext.sampleRate * 0.6;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
                }
                const noise = audioContext.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.5, audioContext.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
                noise.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start();
            }
        }

        function initScene() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a1a);
            camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
            camera.position.set(0, -5, 35);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth + 100, window.innerHeight + 100);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            document.querySelector('.canvas-container').appendChild(renderer.domElement);

            createSky();
            createStars();
            createSea();
            createBeach();
            createCannon();
            createFishes();

            window.addEventListener('click', handleClick);
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('resize', handleResize);
        }

        function createSky() {
            const skyGeometry = new THREE.PlaneGeometry(300, 200);
            const skyMaterial = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 } },
                vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
                fragmentShader: `
                    uniform float time; varying vec2 vUv;
                    void main() {
                        vec3 topColor = vec3(0.02, 0.02, 0.08);
                        vec3 midColor = vec3(0.06, 0.06, 0.15);
                        vec3 bottomColor = vec3(0.08, 0.12, 0.20);
                        float t = smoothstep(0.0, 1.0, vUv.y);
                        vec3 color = mix(bottomColor, midColor, smoothstep(0.0, 0.4, t));
                        color = mix(color, topColor, smoothstep(0.4, 1.0, t));
                        gl_FragColor = vec4(color, 1.0);
                    }
                `
            });
            const sky = new THREE.Mesh(skyGeometry, skyMaterial);
            sky.position.set(0, 20, -50);
            sky.name = 'sky';
            scene.add(sky);
        }

        function createStars() {
            for (let i = 0; i < 300; i++) {
                const geometry = new THREE.SphereGeometry(0.03 + Math.random() * 0.07, 4, 4);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0xffffff, transparent: true, opacity: 0.3 + Math.random() * 0.7
                });
                const star = new THREE.Mesh(geometry, material);
                star.position.set(
                    (Math.random() - 0.5) * 200, 10 + Math.random() * 50, -20 + Math.random() * -25
                );
                star.userData = { 
                    twinkleSpeed: 0.3 + Math.random() * 2.5, 
                    twinkleOffset: Math.random() * Math.PI * 2,
                    baseOpacity: material.opacity
                };
                stars.push(star);
                scene.add(star);
            }
        }

        function createSea() {
            const seaGeometry = new THREE.PlaneGeometry(250, 80, 120, 50);
            const seaMaterial = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 } },
                vertexShader: `
                    uniform float time; varying vec2 vUv; varying float vWave; varying float vHeight;
                    void main() {
                        vUv = uv; vHeight = position.y;
                        vec3 pos = position;
                        float distToShore = position.y + 15.0;
                        float wave = sin(position.x * 0.2 + time * 2.0 - distToShore * 0.3) * 0.25;
                        wave += sin(position.x * 0.35 + time * 1.5 - distToShore * 0.2) * 0.15;
                        wave += sin(position.x * 0.5 + time * 1.0) * 0.1;
                        pos.z += wave * (1.0 - smoothstep(-25.0, -10.0, position.y));
                        vWave = wave;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float time; varying vec2 vUv; varying float vWave; varying float vHeight;
                    float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                    void main() {
                        vec3 deep = vec3(0.0, 0.12, 0.25);
                        vec3 shallow = vec3(0.0, 0.22, 0.35);
                        vec3 foam = vec3(0.8, 0.85, 0.9);
                        float n = noise(vUv * 15.0 + time * 0.05);
                        float shore = smoothstep(-25.0, -12.0, vHeight);
                        vec3 color = mix(deep, shallow, shore * 0.5 + n * 0.15);
                        float foamLine = smoothstep(0.15, 0.3, vWave + n * 0.1);
                        foamLine *= smoothstep(-20.0, -12.0, vHeight);
                        color = mix(color, foam, foamLine * 0.4);
                        gl_FragColor = vec4(color, 1.0);
                    }
                `
            });
            const sea = new THREE.Mesh(seaGeometry, seaMaterial);
            sea.position.set(0, -5, -20);
            sea.rotation.x = -0.25;
            sea.name = 'sea';
            scene.add(sea);
        }

        function createBeach() {
            const beachGeometry = new THREE.PlaneGeometry(250, 50, 80, 40);
            const beachMaterial = new THREE.ShaderMaterial({
                uniforms: { time: { value: 0 } },
                vertexShader: `
                    uniform float time; varying vec2 vUv; varying vec3 vPosition; varying float vElevation;
                    float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                    void main() {
                        vUv = uv; vPosition = position;
                        vec3 pos = position;
                        float elevation = noise(vUv * 8.0) * 0.4;
                        elevation += noise(vUv * 15.0) * 0.2;
                        elevation += noise(vUv * 25.0) * 0.1;
                        pos.z += elevation;
                        vElevation = elevation;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float time; varying vec2 vUv; varying vec3 vPosition; varying float vElevation;
                    float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
                    void main() {
                        vec3 sand1 = vec3(0.78, 0.72, 0.52);
                        vec3 sand2 = vec3(0.84, 0.77, 0.57);
                        vec3 sand3 = vec3(0.70, 0.64, 0.47);
                        vec3 wetSand = vec3(0.65, 0.58, 0.42);
                        float n1 = noise(vUv * 40.0);
                        float n2 = noise(vUv * 80.0);
                        float shore = smoothstep(-35.0, -22.0, vPosition.y);
                        vec3 color = mix(sand1, sand2, n1 * 0.6);
                        color = mix(color, sand3, n2 * 0.25);
                        color = mix(wetSand * 0.9, color, shore);
                        color += (noise(vUv * 300.0) - 0.5) * 0.04;
                        color += vElevation * 0.05;
                        gl_FragColor = vec4(color, 1.0);
                    }
                `
            });
            const beach = new THREE.Mesh(beachGeometry, beachMaterial);
            beach.position.set(0, -28, -8);
            beach.rotation.x = -0.15;
            beach.name = 'beach';
            scene.add(beach);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
            scene.add(ambientLight);
            const moonLight = new THREE.DirectionalLight(0xffffee, 0.35);
            moonLight.position.set(30, 50, 20);
            scene.add(moonLight);
        }

        function createCannon() {
            const cannonGroup = new THREE.Group();
            
            const baseGeometry = new THREE.CylinderGeometry(1.8, 2.5, 3.5, 48);
            const baseMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x4a4a4a, shininess: 15, specular: 0x666666
            });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = -20;
            cannonGroup.add(base);

            const baseRingGeometry = new THREE.TorusGeometry(2.2, 0.15, 8, 48);
            const baseRing = new THREE.Mesh(baseRingGeometry, baseMaterial);
            baseRing.position.y = -18.3;
            baseRing.rotation.x = Math.PI / 2;
            cannonGroup.add(baseRing);

            const tubeGeometry = new THREE.CylinderGeometry(0.9, 0.7, 5.5, 48);
            const tubeMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x5a5a5a, shininess: 40, specular: 0x999999
            });
            cannonTube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            cannonTube.position.y = -15.5;
            cannonGroup.add(cannonTube);

            const rimGeometry = new THREE.TorusGeometry(0.95, 0.12, 8, 48);
            const rimMaterial = new THREE.MeshPhongMaterial({ 
                color: 0x6a6a6a, shininess: 60, specular: 0xbbbbbb
            });
            const rim = new THREE.Mesh(rimGeometry, rimMaterial);
            rim.position.y = -12.7;
            rim.rotation.x = Math.PI / 2;
            cannonGroup.add(rim);

            for (let i = 0; i < 3; i++) {
                const bandGeometry = new THREE.TorusGeometry(0.85 - i * 0.05, 0.08, 8, 48);
                const band = new THREE.Mesh(bandGeometry, rimMaterial);
                band.position.y = -16.5 - i * 1.5;
                band.rotation.x = Math.PI / 2;
                cannonGroup.add(band);
            }

            cannon = cannonGroup;
            scene.add(cannon);
        }

        function createRipple(x, y) {
            const rippleGeometry = new THREE.RingGeometry(0.1, 0.3, 32);
            const rippleMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide
            });
            const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
            ripple.position.set(x, y, -10);
            ripple.rotation.x = -Math.PI / 2 + 0.25;
            ripple.userData = { life: 1, maxSize: 2.5 + Math.random() * 1.5 };
            ripples.push(ripple);
            scene.add(ripple);
        }

        function createFishes() {
            for (let i = 0; i < 6; i++) {
                createFish();
            }
        }

        function createFish() {
            const fishGroup = new THREE.Group();
            const color = fishColors[Math.floor(Math.random() * fishColors.length)];
            
            const bodyGeometry = new THREE.SphereGeometry(0.4, 16, 16);
            const bodyMaterial = new THREE.MeshPhongMaterial({ color, shininess: 60 });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.scale.set(1, 0.65, 2.0);
            fishGroup.add(body);

            const tailGroup = new THREE.Group();
            const tailMainGeometry = new THREE.ConeGeometry(0.35, 0.9, 8);
            const tailMain = new THREE.Mesh(tailMainGeometry, bodyMaterial);
            tailMain.position.set(0, 0, 0.5);
            tailMain.rotation.x = Math.PI / 2;
            tailGroup.add(tailMain);
            
            const tailFin1Geometry = new THREE.ConeGeometry(0.2, 0.5, 8);
            const tailFin1 = new THREE.Mesh(tailFin1Geometry, bodyMaterial);
            tailFin1.position.set(0.25, 0, 0.75);
            tailFin1.rotation.set(Math.PI / 2, 0, 0.4);
            tailGroup.add(tailFin1);
            
            const tailFin2Geometry = new THREE.ConeGeometry(0.2, 0.5, 8);
            const tailFin2 = new THREE.Mesh(tailFin2Geometry, bodyMaterial);
            tailFin2.position.set(-0.25, 0, 0.75);
            tailFin2.rotation.set(Math.PI / 2, 0, -0.4);
            tailGroup.add(tailFin2);
            
            tailGroup.position.set(0, 0, 0.6);
            tailGroup.name = 'tailGroup';
            fishGroup.add(tailGroup);

            const topFinGeometry = new THREE.ConeGeometry(0.15, 0.45, 8);
            const topFin = new THREE.Mesh(topFinGeometry, bodyMaterial);
            topFin.position.set(0, 0.3, 0.1);
            topFin.rotation.z = Math.PI;
            fishGroup.add(topFin);

            const leftFinGeometry = new THREE.ConeGeometry(0.12, 0.35, 8);
            const leftFin = new THREE.Mesh(leftFinGeometry, bodyMaterial);
            leftFin.position.set(0.3, 0.05, -0.1);
            leftFin.rotation.set(0.3, 0, Math.PI / 2 + 0.3);
            leftFin.name = 'leftFin';
            fishGroup.add(leftFin);
            
            const rightFinGeometry = new THREE.ConeGeometry(0.12, 0.35, 8);
            const rightFin = new THREE.Mesh(rightFinGeometry, bodyMaterial);
            rightFin.position.set(-0.3, 0.05, -0.1);
            rightFin.rotation.set(-0.3, 0, -Math.PI / 2 - 0.3);
            rightFin.name = 'rightFin';
            fishGroup.add(rightFin);

            const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
            const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const eye1 = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye1.position.set(0.18, 0.08, -0.45);
            fishGroup.add(eye1);
            const eye2 = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye2.position.set(-0.18, 0.08, -0.45);
            fishGroup.add(eye2);

            fishGroup.position.set(
                (Math.random() - 0.5) * 100,
                -12 + Math.random() * 4,
                -15
            );
            fishGroup.userData = {
                jumpTime: Math.random() * 20,
                jumpInterval: 12 + Math.random() * 18,
                isJumping: false,
                jumpProgress: 0,
                startY: fishGroup.position.y,
                startX: fishGroup.position.x,
                direction: Math.random() > 0.5 ? 1 : -1,
                underWater: true
            };
            fishGroup.visible = false;
            fishes.push(fishGroup);
            scene.add(fishGroup);
        }

        function handleClick(event) {
            if (!canFire) return;
            if (!audioContext) initAudio();
            
            canFire = false;
            setTimeout(() => canFire = true, 500);

            let bulge = 1;
            const bulgeAnim = setInterval(() => {
                bulge -= 0.08;
                if (bulge <= 0) {
                    cannonTube.scale.set(1, 1, 1);
                    clearInterval(bulgeAnim);
                } else {
                    cannonTube.scale.set(1 + bulge * 0.18, 1 - bulge * 0.12, 1 + bulge * 0.18);
                }
            }, 16);

            playSound('launch');

            const vector = new THREE.Vector3(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1,
                0.5
            );
            vector.unproject(camera);
            const dir = vector.sub(camera.position).normalize();
            const distance = -camera.position.z / dir.z;
            const targetPos = camera.position.clone().add(dir.multiplyScalar(distance));

            const maxY = 22;
            const targetY = Math.min(Math.max(targetPos.y * 0.7 + 8, 5), maxY);
            createFirework(Math.max(-35, Math.min(35, targetPos.x * 0.7)), targetY);
        }

        function createFirework(targetX, targetY) {
            const particleCount = 100;
            const isBlessing = Math.random() < 0.12;
            const fireworkType = Math.floor(Math.random() * 12);
            
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            const velocities = [];

            const baseHue = Math.random();

            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] = 0;
                positions[i * 3 + 1] = -13;
                positions[i * 3 + 2] = 0;

                const color = new THREE.Color();
                color.setHSL(baseHue + (Math.random() - 0.5) * 0.1, 1, 0.6 + Math.random() * 0.2);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                velocities.push(new THREE.Vector3(
                    targetX / 180 + (Math.random() - 0.5) * 0.005,
                    0.2 + Math.random() * 0.02,
                    0
                ));
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 0.25,
                vertexColors: true,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });

            const particles = new THREE.Points(geometry, material);
            particles.userData = {
                velocities,
                phase: 'rising',
                targetX,
                targetY,
                type: fireworkType,
                isBlessing,
                life: 1,
                blessingText: blessingTexts[Math.floor(Math.random() * blessingTexts.length)],
                baseHue,
                startY: -13
            };

            createTrail(particles);
            fireworks.push(particles);
            scene.add(particles);
        }

        function createTrail(firework) {
            const trailGeometry = new THREE.BufferGeometry();
            const trailPositions = new Float32Array(20 * 3);
            const trailColors = new Float32Array(20 * 3);
            
            for (let i = 0; i < 20; i++) {
                trailPositions[i * 3] = 0;
                trailPositions[i * 3 + 1] = -13;
                trailPositions[i * 3 + 2] = 0;
                const alpha = 1 - i / 20;
                trailColors[i * 3] = 1 * alpha;
                trailColors[i * 3 + 1] = 0.7 * alpha;
                trailColors[i * 3 + 2] = 0.3 * alpha;
            }
            
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
            
            const trailMaterial = new THREE.LineBasicMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.6,
                blending: THREE.AdditiveBlending
            });
            
            const trail = new THREE.Line(trailGeometry, trailMaterial);
            trail.userData = { firework, length: 0 };
            trails.push(trail);
            scene.add(trail);
        }

        function explodeFirework(firework) {
            playSound('explode');

            const positions = firework.geometry.attributes.position.array;
            const velocities = firework.userData.velocities;
            const type = firework.userData.type;
            const isBlessing = firework.userData.isBlessing;
            const centerX = positions[0], centerY = positions[1];
            const baseHue = firework.userData.baseHue;

            if (isBlessing) {
                createBlessingFirework(centerX, centerY, firework.userData.blessingText, baseHue);
                scene.remove(firework);
                return;
            }

            const particleCount = velocities.length;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const speed = 0.06 + Math.random() * 0.04;
                let vx, vy;

                switch (type) {
                    case 0:
                        vx = Math.cos(angle) * speed;
                        vy = Math.sin(angle) * speed;
                        break;
                    case 1:
                        vx = Math.cos(angle * 5) * speed * Math.cos(angle) * 1.2;
                        vy = Math.sin(angle * 5) * speed * Math.sin(angle) * 1.2;
                        break;
                    case 2:
                        const r = speed * (1 + 0.4 * Math.sin(angle * 3));
                        vx = Math.cos(angle) * r;
                        vy = Math.sin(angle) * r;
                        break;
                    case 3:
                        const layer = i % 2;
                        vx = Math.cos(angle) * speed * (0.7 + layer * 0.6);
                        vy = Math.sin(angle) * speed * (0.7 + layer * 0.6);
                        break;
                    case 4:
                        vx = Math.cos(angle) * speed * Math.pow(Math.abs(Math.cos(angle * 2)), 0.6) * 1.3;
                        vy = Math.sin(angle) * speed * Math.pow(Math.abs(Math.sin(angle * 2)), 0.6) * 1.3;
                        break;
                    case 5:
                        const heartAngle = angle * 2;
                        vx = 16 * Math.pow(Math.sin(heartAngle), 3) * speed * 0.05;
                        vy = (13 * Math.cos(heartAngle) - 5 * Math.cos(2 * heartAngle) - 2 * Math.cos(3 * heartAngle)) * speed * 0.035;
                        break;
                    case 6:
                        vx = (Math.random() - 0.5) * speed * 2;
                        vy = (Math.random() - 0.5) * speed * 2;
                        break;
                    case 7:
                        const ring = i % 3;
                        vx = Math.cos(angle) * speed * (0.5 + ring * 0.4);
                        vy = Math.sin(angle) * speed * (0.5 + ring * 0.4);
                        break;
                    case 8:
                        vx = (Math.random() - 0.5) * speed * 1.2;
                        vy = Math.random() * speed * 1.5;
                        break;
                    case 9:
                        const spiralR = speed * (1 + i / particleCount * 0.3);
                        vx = Math.cos(angle + i * 0.12) * spiralR;
                        vy = Math.sin(angle + i * 0.12) * spiralR;
                        break;
                    case 10:
                        vx = Math.cos(angle) * speed;
                        vy = Math.abs(Math.sin(angle)) * speed * 1.2;
                        break;
                    default:
                        vx = Math.cos(angle) * speed * (0.8 + Math.random() * 0.4);
                        vy = Math.sin(angle) * speed * (0.8 + Math.random() * 0.4);
                }

                velocities[i].set(vx, vy, 0);
            }

            firework.userData.phase = 'exploding';
        }

        function createBlessingFirework(x, y, text, baseHue) {
            const charCount = text.length;
            const particlesPerChar = 60;
            const totalParticles = charCount * particlesPerChar;
            
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(totalParticles * 3);
            const colors = new Float32Array(totalParticles * 3);
            const velocities = [];

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = charCount * 80;
            canvas.height = 100;
            ctx.font = 'bold 72px "Microsoft YaHei", "PingFang SC", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            let particleIndex = 0;
            for (let px = 0; px < canvas.width; px += 2) {
                for (let py = 0; py < canvas.height; py += 2) {
                    if (imageData.data[(py * canvas.width + px) * 4 + 3] > 80 && particleIndex < totalParticles) {
                        const offsetX = (px - canvas.width / 2) / 18;
                        const offsetY = (canvas.height / 2 - py) / 18;

                        positions[particleIndex * 3] = x + offsetX * 0.3;
                        positions[particleIndex * 3 + 1] = y + offsetY * 0.3;
                        positions[particleIndex * 3 + 2] = 0;

                        const hue = baseHue + (Math.random() - 0.5) * 0.15;
                        const color = new THREE.Color();
                        color.setHSL(hue, 1, 0.65 + Math.random() * 0.15);
                        colors[particleIndex * 3] = color.r;
                        colors[particleIndex * 3 + 1] = color.g;
                        colors[particleIndex * 3 + 2] = color.b;

                        velocities.push(new THREE.Vector3(
                            offsetX * 0.015 + (Math.random() - 0.5) * 0.008,
                            offsetY * 0.015 + (Math.random() - 0.5) * 0.008,
                            0
                        ));
                        particleIndex++;
                    }
                }
            }

            for (let i = particleIndex; i < totalParticles; i++) {
                let px, py;
                do {
                    px = Math.floor(Math.random() * canvas.width);
                    py = Math.floor(Math.random() * canvas.height);
                } while (imageData.data[(py * canvas.width + px) * 4 + 3] < 80);

                const offsetX = (px - canvas.width / 2) / 18;
                const offsetY = (canvas.height / 2 - py) / 18;

                positions[i * 3] = x + offsetX * 0.3;
                positions[i * 3 + 1] = y + offsetY * 0.3;
                positions[i * 3 + 2] = 0;

                const hue = baseHue + (Math.random() - 0.5) * 0.15;
                const color = new THREE.Color();
                color.setHSL(hue, 1, 0.65 + Math.random() * 0.15);
                colors[i * 3] = color.r;
                colors[i * 3 + 1] = color.g;
                colors[i * 3 + 2] = color.b;

                velocities.push(new THREE.Vector3(
                    offsetX * 0.015 + (Math.random() - 0.5) * 0.008,
                    offsetY * 0.015 + (Math.random() - 0.5) * 0.008,
                    0
                ));
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 0.35,
                vertexColors: true,
                transparent: true,
                opacity: 1,
                blending: THREE.AdditiveBlending
            });

            const particles = new THREE.Points(geometry, material);
            particles.userData = {
                velocities,
                phase: 'exploding',
                life: 2,
                isText: true
            };

            fireworks.push(particles);
            scene.add(particles);
        }

        function handleMouseMove(event) {
            targetMouseX = (event.clientX / window.innerWidth - 0.5) * 2;
            targetMouseY = (event.clientY / window.innerHeight - 0.5) * 2;
        }

        function handleResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth + 100, window.innerHeight + 100);
        }

        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            time += 0.016;

            mouseX += (targetMouseX - mouseX) * 0.06;
            mouseY += (targetMouseY - mouseY) * 0.06;

            const parallaxX = -mouseX * maxParallax;
            const parallaxY = mouseY * maxParallax * 0.7;
            scene.position.x = parallaxX;
            scene.position.y = parallaxY;

            stars.forEach(star => {
                const twinkle = Math.sin(time * star.userData.twinkleSpeed + star.userData.twinkleOffset);
                star.material.opacity = star.userData.baseOpacity * (0.5 + Math.abs(twinkle) * 0.5);
            });

            const sea = scene.getObjectByName('sea');
            if (sea) sea.material.uniforms.time.value = time;

            for (let i = ripples.length - 1; i >= 0; i--) {
                const ripple = ripples[i];
                ripple.userData.life -= 0.018;
                const scale = 1 + (1 - ripple.userData.life) * ripple.userData.maxSize;
                ripple.scale.set(scale, scale, scale);
                ripple.material.opacity = ripple.userData.life * 0.5;
                
                if (ripple.userData.life <= 0) {
                    scene.remove(ripple);
                    ripples.splice(i, 1);
                }
            }

            fishes.forEach(fish => {
                fish.userData.jumpTime += 0.016;
                
                const tailGroup = fish.getObjectByName('tailGroup');
                if (tailGroup) {
                    tailGroup.rotation.y = Math.sin(time * 10 + fish.position.x * 0.5) * 0.6;
                }
                const leftFin = fish.getObjectByName('leftFin');
                const rightFin = fish.getObjectByName('rightFin');
                if (leftFin) leftFin.rotation.z = -Math.PI / 2 - 0.3 + Math.sin(time * 6) * 0.2;
                if (rightFin) rightFin.rotation.z = Math.PI / 2 + 0.3 - Math.sin(time * 6) * 0.2;

                if (fish.userData.jumpTime > fish.userData.jumpInterval && !fish.userData.isJumping) {
                    if (fish.position.x > -40 && fish.position.x < 40) {
                        fish.userData.isJumping = true;
                        fish.userData.jumpProgress = 0;
                        fish.userData.startX = fish.position.x;
                        fish.visible = true;
                        createRipple(fish.position.x, fish.userData.startY);
                    } else {
                        fish.userData.jumpTime = 0;
                    }
                }

                if (fish.userData.isJumping) {
                    fish.userData.jumpProgress += 0.012;
                    const t = fish.userData.jumpProgress;
                    
                    fish.position.y = fish.userData.startY + Math.sin(t * Math.PI) * 7 * (1 + t * 0.3);
                    fish.position.x = fish.userData.startX + fish.userData.direction * t * 6;
                    fish.rotation.z = Math.sin(t * Math.PI) * 0.35;
                    fish.rotation.x = t * Math.PI * 0.4;

                    if (t >= 1) {
                        fish.userData.isJumping = false;
                        fish.userData.jumpTime = 0;
                        fish.userData.jumpInterval = 15 + Math.random() * 20;
                        fish.position.y = fish.userData.startY;
                        fish.rotation.z = 0;
                        fish.rotation.x = 0;
                        fish.visible = false;
                        fish.userData.direction = Math.random() > 0.5 ? 1 : -1;
                        createRipple(fish.position.x, fish.userData.startY);
                    }
                }
            });

            for (let i = fireworks.length - 1; i >= 0; i--) {
                const fw = fireworks[i];
                if (fw.userData.phase === 'rising') {
                    const positions = fw.geometry.attributes.position.array;
                    const velocities = fw.userData.velocities;

                    for (let j = 0; j < velocities.length; j++) {
                        velocities[j].y -= 0.0006;
                        positions[j * 3] += velocities[j].x;
                        positions[j * 3 + 1] += velocities[j].y;
                        positions[j * 3] = Math.max(-45, Math.min(45, positions[j * 3]));
                        positions[j * 3 + 1] = Math.min(35, positions[j * 3 + 1]);
                    }
                    fw.geometry.attributes.position.needsUpdate = true;

                    if (positions[1] >= fw.userData.targetY || fw.userData.velocities[0].y <= 0.05) {
                        explodeFirework(fw);
                    }
                } else if (fw.userData.phase === 'exploding') {
                    const positions = fw.geometry.attributes.position.array;
                    const velocities = fw.userData.velocities;
                    const decay = fw.userData.isText ? 0.006 : 0.01;
                    fw.userData.life -= decay;
                    fw.material.opacity = fw.userData.life;

                    for (let j = 0; j < velocities.length; j++) {
                        velocities[j].y -= 0.0006;
                        velocities[j].multiplyScalar(0.99);
                        positions[j * 3] += velocities[j].x;
                        positions[j * 3 + 1] += velocities[j].y;
                        positions[j * 3] = Math.max(-50, Math.min(50, positions[j * 3]));
                        positions[j * 3 + 1] = Math.max(-40, Math.min(40, positions[j * 3 + 1]));
                    }
                    fw.geometry.attributes.position.needsUpdate = true;

                    if (fw.userData.life <= 0) {
                        scene.remove(fw);
                        fireworks.splice(i, 1);
                    }
                }
            }

            for (let i = trails.length - 1; i >= 0; i--) {
                const trail = trails[i];
                const fw = trail.userData.firework;
                
                if (fw.userData.phase === 'rising' && fw.geometry.attributes.position) {
                    const pos = fw.geometry.attributes.position.array;
                    const trailPos = trail.geometry.attributes.position.array;
                    
                    for (let j = 19; j > 0; j--) {
                        trailPos[j * 3] = trailPos[(j - 1) * 3];
                        trailPos[j * 3 + 1] = trailPos[(j - 1) * 3 + 1];
                    }
                    trailPos[0] = pos[0];
                    trailPos[1] = pos[1];
                    
                    trail.geometry.attributes.position.needsUpdate = true;
                } else {
                    trail.material.opacity -= 0.04;
                    if (trail.material.opacity <= 0) {
                        scene.remove(trail);
                        trails.splice(i, 1);
                    }
                }
            }

            renderer.render(scene, camera);
        }

        function checkMobile() {
            isMobile.value = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        onMounted(() => {
            checkMobile();
            if (!isMobile.value) {
                initScene();
                animate();
                setTimeout(() => {
                    const hint = document.querySelector('.hint');
                    if (hint) hint.classList.add('fade-out');
                }, 4000);
            }
        });

        onUnmounted(() => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', handleResize);
        });

        return { isMobile };
    }
}).mount('#app');
