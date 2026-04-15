const { createApp, ref, onMounted, onUnmounted } = Vue;

createApp({
    setup() {
        const canvasContainer = ref(null);
        const isMobile = ref(false);
        const showHint = ref(true);

        let scene, camera, renderer;
        let cannon = null;
        let cannonBulge = 0;
        let stars = [];
        let fireworks = [];
        let fishes = [];
        let ripples = [];
        let lastFireTime = 0;
        let targetOffsetX = 0, targetOffsetY = 0;
        let currentOffsetX = 0, currentOffsetY = 0;
        let audioContext;
        let skyMesh, seaMesh, sandMesh, sandBorderMesh;
        let time = 0;

        const blessings = [
            '新年快乐', '万事如意', '心想事成', '阖家幸福',
            '前程似锦', '步步高升', '财源广进', '吉祥如意',
            '平安喜乐', '福星高照', '鸿运当头', '大展宏图',
            '好运连连', '幸福美满', '事业有成'
        ];

        const fireworkTypes = [
            { name: 'spherical', particles: 60, spread: 0.6, gravity: 0.004 },
            { name: 'ring', particles: 45, spread: 0.5, gravity: 0.003 },
            { name: 'heart', particles: 50, spread: 0.45, gravity: 0.0035 },
            { name: 'star', particles: 45, spread: 0.5, gravity: 0.003 },
            { name: 'spiral', particles: 50, spread: 0.6, gravity: 0.004 },
            { name: 'chrysanthemum', particles: 70, spread: 0.7, gravity: 0.005 },
            { name: 'willow', particles: 60, spread: 0.75, gravity: 0.006 },
            { name: 'palm', particles: 45, spread: 0.65, gravity: 0.0045 },
            { name: 'dahlia', particles: 65, spread: 0.6, gravity: 0.004 },
            { name: 'peony', particles: 70, spread: 0.65, gravity: 0.004 },
            { name: 'crossette', particles: 50, spread: 0.6, gravity: 0.0035 },
            { name: 'hidden', particles: 70, spread: 0.7, gravity: 0.0045, isHidden: true }
        ];

        const fishColors = [
            0x4a90d9, 0x50c878, 0xffd700, 0xff6b6b, 0x9b59b6,
            0x00bcd4, 0xe74c3c, 0x1abc9c, 0xf39c12, 0x3498db
        ];

        function checkMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                window.innerWidth < 768;
        }

        function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        function playLaunchSound() {
            if (!audioContext) return;
            try {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.4);
                
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.4);
            } catch (e) {}
        }

        function playExplosionSound() {
            if (!audioContext) return;
            try {
                const bufferSize = audioContext.sampleRate * 0.4;
                const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
                const data = buffer.getChannelData(0);
                
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
                }
                
                const source = audioContext.createBufferSource();
                const gainNode = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();
                
                source.buffer = buffer;
                filter.type = 'lowpass';
                filter.frequency.value = 800;
                
                source.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
                
                source.start();
            } catch (e) {}
        }

        function createSkyTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0a0a1a');
            gradient.addColorStop(0.3, '#0d1033');
            gradient.addColorStop(0.6, '#151a4a');
            gradient.addColorStop(1, '#1a2055');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            return new THREE.CanvasTexture(canvas);
        }

        function createSeaTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#0a1a3a');
            gradient.addColorStop(0.5, '#0d2040');
            gradient.addColorStop(1, '#0a1528');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < 30; i++) {
                const y = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x < canvas.width; x += 20) {
                    ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 3);
                }
                ctx.strokeStyle = `rgba(100, 150, 200, ${Math.random() * 0.1 + 0.05})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 2 + 1, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(150, 200, 255, ${Math.random() * 0.1})`;
                ctx.fill();
            }
            
            return new THREE.CanvasTexture(canvas);
        }

        function createSandTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#3d2b1f');
            gradient.addColorStop(0.3, '#4a3628');
            gradient.addColorStop(0.7, '#5c4033');
            gradient.addColorStop(1, '#6b4423');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            for (let i = 0; i < 1200; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const size = Math.random() * 2 + 0.5;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${180 + Math.random() * 40}, ${140 + Math.random() * 30}, ${80 + Math.random() * 20}, ${Math.random() * 0.4 + 0.1})`;
                ctx.fill();
            }
            
            for (let i = 0; i < 80; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const w = Math.random() * 40 + 15;
                const h = Math.random() * 15 + 8;
                ctx.beginPath();
                ctx.ellipse(x, y, w, h, Math.random() * Math.PI, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${60 + Math.random() * 30}, ${40 + Math.random() * 20}, ${20 + Math.random() * 15}, ${Math.random() * 0.2 + 0.08})`;
                ctx.fill();
            }
            
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.arc(x, y, Math.random() * 25 + 10, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(80, 60, 40, ${Math.random() * 0.15})`;
                ctx.fill();
            }
            
            for (let i = 0; i < 30; i++) {
                const startX = Math.random() * canvas.width;
                const startY = Math.random() * canvas.height;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                for (let j = 0; j < 5; j++) {
                    const nextX = startX + (Math.random() - 0.5) * 60;
                    const nextY = startY + j * 8 + Math.random() * 5;
                    ctx.lineTo(nextX, nextY);
                }
                ctx.strokeStyle = `rgba(90, 70, 50, ${Math.random() * 0.12 + 0.05})`;
                ctx.lineWidth = Math.random() * 3 + 1;
                ctx.stroke();
            }
            
            for (let i = 0; i < 40; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const radius = Math.random() * 15 + 8;
                const gradient2 = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient2.addColorStop(0, `rgba(70, 55, 35, ${Math.random() * 0.15 + 0.05})`);
                gradient2.addColorStop(1, 'rgba(70, 55, 35, 0)');
                ctx.fillStyle = gradient2;
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            }
            
            return new THREE.CanvasTexture(canvas);
        }

        function initThree() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x0a0a1a);
            
            const width = window.innerWidth;
            const height = window.innerHeight;
            camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
            camera.position.set(0, 0, 20);
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(width, height);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            canvasContainer.value.appendChild(renderer.domElement);

            createBackground();
            createStars();
            createCannon();
        }

        function createBackground() {
            const skyTexture = createSkyTexture();
            const skyGeometry = new THREE.PlaneGeometry(100, 50);
            const skyMaterial = new THREE.MeshBasicMaterial({
                map: skyTexture,
                side: THREE.DoubleSide
            });
            skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
            skyMesh.position.set(0, 18, -35);
            scene.add(skyMesh);

            const seaTexture = createSeaTexture();
            const seaGeometry = new THREE.PlaneGeometry(100, 25);
            const seaMaterial = new THREE.MeshBasicMaterial({
                map: seaTexture,
                side: THREE.DoubleSide,
                transparent: true
            });
            seaMesh = new THREE.Mesh(seaGeometry, seaMaterial);
            seaMesh.position.set(0, -2, -25);
            scene.add(seaMesh);

            createWavyShoreline();

            const sandTexture = createSandTexture();
            
            const sandShape = new THREE.Shape();
            sandShape.moveTo(-50, -8);
            for (let x = -50; x <= 50; x += 0.3) {
                const y = -8 + 
                    Math.sin(x * 0.2) * 0.6 + 
                    Math.sin(x * 0.5) * 0.3 + 
                    Math.sin(x * 0.8) * 0.2 +
                    Math.sin(x * 1.3) * 0.15;
                sandShape.lineTo(x, y);
            }
            sandShape.lineTo(50, -20);
            sandShape.lineTo(-50, -20);
            sandShape.lineTo(-50, -8);
            
            const sandGeometry = new THREE.ShapeGeometry(sandShape);
            const sandMaterial = new THREE.MeshBasicMaterial({
                map: sandTexture,
                side: THREE.DoubleSide
            });
            sandMesh = new THREE.Mesh(sandGeometry, sandMaterial);
            sandMesh.position.z = -15;
            scene.add(sandMesh);

            const borderPoints = [];
            for (let x = -50; x <= 50; x += 0.2) {
                const y = -8 + 
                    Math.sin(x * 0.2) * 0.6 + 
                    Math.sin(x * 0.5) * 0.3 + 
                    Math.sin(x * 0.8) * 0.2 +
                    Math.sin(x * 1.3) * 0.15;
                borderPoints.push(new THREE.Vector3(x, y, -14.5));
            }
            
            const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
            const borderMaterial = new THREE.LineBasicMaterial({
                color: 0x2a1a0a,
                transparent: true,
                opacity: 0.5,
                linewidth: 2
            });
            sandBorderMesh = new THREE.Line(borderGeometry, borderMaterial);
            scene.add(sandBorderMesh);
        }

        function createWavyShoreline() {
            const points = [];
            for (let x = -50; x <= 50; x += 0.3) {
                const y = -7 + 
                    Math.sin(x * 0.15) * 1.2 + 
                    Math.sin(x * 0.35) * 0.7 + 
                    Math.sin(x * 0.65) * 0.4 + 
                    Math.sin(x * 1.1) * 0.25 +
                    Math.sin(x * 1.8) * 0.15;
                points.push(new THREE.Vector2(x, y));
            }
            
            const waveShape = new THREE.Shape();
            waveShape.moveTo(-50, -7);
            points.forEach(p => waveShape.lineTo(p.x, p.y));
            waveShape.lineTo(50, -20);
            waveShape.lineTo(-50, -20);
            waveShape.lineTo(-50, -7);
            
            const waveGeometry = new THREE.ShapeGeometry(waveShape);
            const waveMaterial = new THREE.MeshBasicMaterial({
                color: 0x0d2040,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });
            const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
            waveMesh.position.z = -20;
            scene.add(waveMesh);

            const foamPoints = [];
            for (let x = -50; x <= 50; x += 0.2) {
                const y = -7 + 
                    Math.sin(x * 0.15) * 1.2 + 
                    Math.sin(x * 0.35) * 0.7 + 
                    Math.sin(x * 0.65) * 0.4;
                foamPoints.push(new THREE.Vector3(x, y, -19.5));
            }
            
            const foamGeometry = new THREE.BufferGeometry().setFromPoints(foamPoints);
            const foamMaterial = new THREE.LineBasicMaterial({
                color: 0x4a6080,
                transparent: true,
                opacity: 0.6
            });
            const foamLine = new THREE.Line(foamGeometry, foamMaterial);
            scene.add(foamLine);
        }

        function createStars() {
            for (let i = 0; i < 150; i++) {
                const size = Math.random() * 0.03 + 0.015;
                const starGeometry = new THREE.CircleGeometry(size, 8);
                const starMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: Math.random() * 0.5 + 0.2
                });
                const star = new THREE.Mesh(starGeometry, starMaterial);
                
                star.position.set(
                    (Math.random() - 0.5) * 80,
                    Math.random() * 20 + 8,
                    -30 - Math.random() * 5
                );
                
                star.userData = {
                    baseOpacity: starMaterial.opacity,
                    twinkleSpeed: Math.random() * 3 + 1,
                    twinkleOffset: Math.random() * Math.PI * 2,
                    baseX: star.position.x,
                    baseY: star.position.y
                };
                
                stars.push(star);
                scene.add(star);
            }
        }

        function createCannon() {
            const cannonGroup = new THREE.Group();

            const baseGeometry = new THREE.CylinderGeometry(0.6, 0.8, 0.4, 16);
            const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            base.position.y = 0;
            cannonGroup.add(base);

            const baseRingGeometry = new THREE.TorusGeometry(0.7, 0.08, 8, 16);
            const baseRingMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const baseRing = new THREE.Mesh(baseRingGeometry, baseRingMaterial);
            baseRing.rotation.x = Math.PI / 2;
            baseRing.position.y = 0.2;
            cannonGroup.add(baseRing);

            const tubeGeometry = new THREE.CylinderGeometry(0.35, 0.45, 1.5, 16);
            const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
            const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
            tube.position.y = 0.95;
            cannonGroup.add(tube);

            for (let i = 0; i < 3; i++) {
                const ringGeometry = new THREE.TorusGeometry(0.42, 0.05, 8, 16);
                const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.rotation.x = Math.PI / 2;
                ring.position.y = 0.5 + i * 0.4;
                cannonGroup.add(ring);
            }

            const muzzleGeometry = new THREE.CylinderGeometry(0.45, 0.35, 0.3, 16);
            const muzzleMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
            muzzle.position.y = 1.85;
            cannonGroup.add(muzzle);

            const muzzleRingGeometry = new THREE.TorusGeometry(0.48, 0.06, 8, 16);
            const muzzleRingMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
            const muzzleRing = new THREE.Mesh(muzzleRingGeometry, muzzleRingMaterial);
            muzzleRing.rotation.x = Math.PI / 2;
            muzzleRing.position.y = 2;
            cannonGroup.add(muzzleRing);

            const innerMuzzleGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 16);
            const innerMuzzleMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
            const innerMuzzle = new THREE.Mesh(innerMuzzleGeometry, innerMuzzleMaterial);
            innerMuzzle.position.y = 2.05;
            cannonGroup.add(innerMuzzle);

            cannonGroup.position.set(0, -9, 0);
            
            cannon = cannonGroup;
            scene.add(cannon);
        }

        function createFirework(targetY) {
            const typeIndex = Math.random() < 0.05 ? 11 : Math.floor(Math.random() * 11);
            const type = fireworkTypes[typeIndex];
            
            const colors = [
                0xff3333, 0x33ff33, 0x3333ff, 0xffff33,
                0xff33ff, 0x33ffff, 0xff6600, 0xff1493,
                0x00ff7f, 0xffd700, 0x9400d3, 0x00bfff,
                0xff69b4, 0x7fff00, 0xdc143c
            ];
            
            const cannonX = cannon ? cannon.position.x : 0;
            const cannonY = cannon ? cannon.position.y + 2.1 : -7;
            
            const firework = {
                x: cannonX,
                y: cannonY,
                targetY: targetY,
                particles: [],
                type: type,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: 0.15 + Math.random() * 0.05,
                trail: [],
                exploded: false,
                blessing: type.isHidden ? blessings[Math.floor(Math.random() * blessings.length)] : null,
                blessingSprites: []
            };

            const trailGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const trailMaterial = new THREE.MeshBasicMaterial({
                color: firework.color,
                transparent: true,
                opacity: 0.9
            });
            
            for (let i = 0; i < 8; i++) {
                const trail = new THREE.Mesh(trailGeometry, trailMaterial.clone());
                trail.visible = false;
                scene.add(trail);
                firework.trail.push(trail);
            }

            fireworks.push(firework);
            playLaunchSound();
        }

        function explodeFirework(firework) {
            playExplosionSound();
            firework.exploded = true;

            const type = firework.type;
            const particleCount = type.particles;
            const gravity = type.gravity;
            
            for (let i = 0; i < particleCount; i++) {
                const geometry = new THREE.SphereGeometry(0.05, 6, 6);
                const material = new THREE.MeshBasicMaterial({
                    color: firework.color,
                    transparent: true,
                    opacity: 1
                });
                const particle = new THREE.Mesh(geometry, material);
                
                let vx, vy, vz;
                const spread = type.spread;
                
                switch (type.name) {
                    case 'spherical':
                        const phi = Math.random() * Math.PI * 2;
                        const theta = Math.random() * Math.PI;
                        const r = spread * (0.5 + Math.random() * 0.5);
                        vx = Math.sin(theta) * Math.cos(phi) * r;
                        vy = Math.sin(theta) * Math.sin(phi) * r;
                        vz = Math.cos(theta) * r * 0.3;
                        break;
                    case 'ring':
                        const angle = (i / particleCount) * Math.PI * 2;
                        vx = Math.cos(angle) * spread;
                        vy = Math.sin(angle) * spread;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'heart':
                        const t = (i / particleCount) * Math.PI * 2;
                        vx = 1.2 * Math.pow(Math.sin(t), 3) * spread * 0.5;
                        vy = (1 * Math.sin(t) - 0.4 * Math.sin(2*t) - 0.15 * Math.sin(3*t) - 0.08 * Math.sin(4*t)) * spread * 0.5;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'star':
                        const starAngle = (i / particleCount) * Math.PI * 2;
                        const starR = (i % 2 === 0) ? spread : spread * 0.5;
                        vx = Math.cos(starAngle) * starR;
                        vy = Math.sin(starAngle) * starR;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'spiral':
                        const spiralAngle = (i / particleCount) * Math.PI * 6;
                        const spiralR = (i / particleCount) * spread;
                        vx = Math.cos(spiralAngle) * spiralR;
                        vy = Math.sin(spiralAngle) * spiralR;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'chrysanthemum':
                        const chrysPhi = Math.random() * Math.PI * 2;
                        const chrysTheta = Math.random() * Math.PI * 0.6 + 0.2;
                        const chrysR = spread * (0.6 + Math.random() * 0.4);
                        vx = Math.sin(chrysTheta) * Math.cos(chrysPhi) * chrysR;
                        vy = Math.sin(chrysTheta) * Math.sin(chrysPhi) * chrysR;
                        vz = Math.cos(chrysTheta) * chrysR * 0.3;
                        break;
                    case 'willow':
                        const willowAngle = Math.random() * Math.PI * 2;
                        const willowR = Math.random() * spread;
                        vx = Math.cos(willowAngle) * willowR * 0.5;
                        vy = Math.sin(willowAngle) * willowR * 0.3 + 0.3;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'palm':
                        const palmAngle = (i / particleCount) * Math.PI * 2;
                        const palmR = Math.random() * spread;
                        vx = Math.cos(palmAngle) * palmR * 0.6;
                        vy = palmR * 0.8 + 0.2;
                        vz = Math.sin(palmAngle) * palmR * 0.3;
                        break;
                    case 'dahlia':
                        const dahliaAngle = Math.random() * Math.PI * 2;
                        const dahliaR = 0.4 + Math.random() * 0.6;
                        vx = Math.cos(dahliaAngle) * dahliaR * spread;
                        vy = Math.sin(dahliaAngle) * dahliaR * spread;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'peony':
                        const peonyAngle = Math.random() * Math.PI * 2;
                        const peonyR = Math.random() * spread;
                        vx = Math.cos(peonyAngle) * peonyR;
                        vy = Math.sin(peonyAngle) * peonyR;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'crossette':
                        const crossAngle = Math.random() * Math.PI * 2;
                        const crossR = 0.3 + Math.random() * 0.7;
                        vx = Math.cos(crossAngle) * crossR * spread;
                        vy = Math.sin(crossAngle) * crossR * spread;
                        vz = (Math.random() - 0.5) * 0.2;
                        break;
                    case 'hidden':
                        const hiddenAngle = Math.random() * Math.PI * 2;
                        const hiddenR = Math.random() * spread;
                        vx = Math.cos(hiddenAngle) * hiddenR;
                        vy = Math.sin(hiddenAngle) * hiddenR;
                        vz = (Math.random() - 0.5) * 0.2;
                        material.color.setHex(0xffd700);
                        break;
                    default:
                        vx = (Math.random() - 0.5) * 2 * spread;
                        vy = (Math.random() - 0.5) * 2 * spread;
                        vz = (Math.random() - 0.5) * 0.2;
                }

                particle.position.set(firework.x, firework.y, 0);
                particle.userData = {
                    vx: vx,
                    vy: vy,
                    vz: vz,
                    gravity: gravity,
                    life: 1,
                    decay: 0.0015 + Math.random() * 0.001,
                    drag: 0.995
                };
                
                scene.add(particle);
                firework.particles.push(particle);
            }

            if (firework.type.isHidden && firework.blessing) {
                createBlessingText(firework);
            }
        }

        function createBlessingText(firework) {
            const blessing = firework.blessing;
            const chars = blessing.split('');
            const spacing = 1.2;
            const startX = -((chars.length - 1) * spacing) / 2;
            
            chars.forEach((char, index) => {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                
                ctx.fillStyle = '#ffd700';
                ctx.font = 'bold 140px Microsoft YaHei, SimHei, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 25;
                ctx.fillText(char, 128, 128);
                
                ctx.shadowBlur = 15;
                ctx.fillText(char, 128, 128);
                
                ctx.shadowBlur = 8;
                ctx.fillText(char, 128, 128);
                
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 1
                });
                const sprite = new THREE.Sprite(material);
                
                sprite.position.set(
                    firework.x + startX + index * spacing,
                    firework.y + 2,
                    0
                );
                sprite.scale.set(2.5, 2.5, 1);
                
                sprite.userData = {
                    vy: 0.008,
                    life: 1,
                    decay: 0.002
                };
                
                scene.add(sprite);
                firework.blessingSprites.push(sprite);
            });
        }

        function createFish() {
            const fishColor = fishColors[Math.floor(Math.random() * fishColors.length)];
            const depthZ = -16 - Math.random() * 12;
            const depthFactor = 1 + (depthZ + 16) / 20;
            const fishSize = (0.35 + Math.random() * 0.2) * depthFactor;
            
            const fishGroup = new THREE.Group();
            
            const bodyGeometry = new THREE.SphereGeometry(fishSize, 12, 8);
            bodyGeometry.scale(2, 0.8, 0.5);
            const bodyMaterial = new THREE.MeshBasicMaterial({ color: fishColor });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            fishGroup.add(body);

            const headGeometry = new THREE.SphereGeometry(fishSize * 0.55, 10, 8);
            headGeometry.scale(1.2, 0.9, 0.9);
            const head = new THREE.Mesh(headGeometry, bodyMaterial);
            head.position.x = fishSize * 1.6;
            fishGroup.add(head);

            const eyeGeometry = new THREE.SphereGeometry(fishSize * 0.15, 8, 8);
            const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const pupilGeometry = new THREE.SphereGeometry(fishSize * 0.08, 8, 8);
            const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            
            const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            leftEye.position.set(fishSize * 1.9, fishSize * 0.2, fishSize * 0.3);
            const leftPupil = new THREE.Mesh(pupilGeometry, pupilMaterial);
            leftPupil.position.set(fishSize * 0.05, 0, fishSize * 0.05);
            leftEye.add(leftPupil);
            fishGroup.add(leftEye);
            
            const rightEye = leftEye.clone();
            rightEye.position.z = -fishSize * 0.3;
            fishGroup.add(rightEye);

            const tailGroup = new THREE.Group();
            
            const tailGeometry = new THREE.ConeGeometry(fishSize * 0.6, fishSize * 1.5, 6);
            const tailMaterial = new THREE.MeshBasicMaterial({ color: fishColor });
            const tail = new THREE.Mesh(tailGeometry, tailMaterial);
            tail.rotation.z = Math.PI / 2;
            tail.position.x = -fishSize * 0.75;
            tailGroup.add(tail);
            
            const tailFinGeometry = new THREE.ConeGeometry(fishSize * 0.4, fishSize * 0.8, 4);
            const tailFinTop = new THREE.Mesh(tailFinGeometry, tailMaterial);
            tailFinTop.position.set(-fishSize * 1.2, fishSize * 0.3, 0);
            tailFinTop.rotation.z = -Math.PI / 6;
            tailGroup.add(tailFinTop);
            
            const tailFinBottom = new THREE.Mesh(tailFinGeometry, tailMaterial);
            tailFinBottom.position.set(-fishSize * 1.2, -fishSize * 0.3, 0);
            tailFinBottom.rotation.z = Math.PI / 6;
            tailGroup.add(tailFinBottom);
            
            tailGroup.position.x = -fishSize * 1.8;
            fishGroup.add(tailGroup);

            const dorsalGeometry = new THREE.ConeGeometry(fishSize * 0.25, fishSize * 0.7, 4);
            const dorsalFin = new THREE.Mesh(dorsalGeometry, bodyMaterial);
            dorsalFin.position.set(fishSize * 0.2, fishSize * 0.5, 0);
            fishGroup.add(dorsalFin);

            const pectoralGeometry = new THREE.ConeGeometry(fishSize * 0.15, fishSize * 0.4, 4);
            const pectoralLeft = new THREE.Mesh(pectoralGeometry, bodyMaterial);
            pectoralLeft.position.set(fishSize * 0.8, -fishSize * 0.1, fishSize * 0.3);
            pectoralLeft.rotation.x = Math.PI / 4;
            fishGroup.add(pectoralLeft);
            
            const pectoralRight = new THREE.Mesh(pectoralGeometry, bodyMaterial);
            pectoralRight.position.set(fishSize * 0.8, -fishSize * 0.1, -fishSize * 0.3);
            pectoralRight.rotation.x = -Math.PI / 4;
            fishGroup.add(pectoralRight);

            const startX = (Math.random() - 0.5) * 40;
            const startY = -2 - Math.random() * 6;
            const direction = startX > 0 ? -1 : 1;
            fishGroup.position.set(startX, startY, depthZ);
            if (direction < 0) {
                fishGroup.rotation.y = Math.PI;
            }
            
            const fish = {
                mesh: fishGroup,
                tailGroup: tailGroup,
                vx: direction * (0.05 + Math.random() * 0.03) * depthFactor,
                vy: 0.15 + Math.random() * 0.08,
                tailPhase: Math.random() * Math.PI * 2,
                gravity: 0.005,
                inWater: true,
                jumped: false,
                waterLevel: startY + 1.5,
                depthZ: depthZ
            };
            
            scene.add(fishGroup);
            fishes.push(fish);
        }

        function createRipple(x, y, z) {
            const ripple = {
                x: x,
                y: y,
                z: z,
                radius: 0.1,
                maxRadius: 2.0 + Math.random() * 0.8,
                opacity: 0.6,
                mesh: null
            };
            
            const geometry = new THREE.RingGeometry(ripple.radius, ripple.radius + 0.05, 32);
            const material = new THREE.MeshBasicMaterial({
                color: 0x6a9ab0,
                transparent: true,
                opacity: ripple.opacity,
                side: THREE.DoubleSide
            });
            ripple.mesh = new THREE.Mesh(geometry, material);
            ripple.mesh.position.set(x, y, z);
            ripple.mesh.rotation.x = -Math.PI / 2;
            
            scene.add(ripple.mesh);
            ripples.push(ripple);
        }

        function updateFireworks() {
            for (let i = fireworks.length - 1; i >= 0; i--) {
                const fw = fireworks[i];
                
                if (!fw.exploded) {
                    fw.y += fw.speed;
                    
                    fw.trail.forEach((trail, index) => {
                        const trailY = fw.y - (index + 1) * 0.2;
                        trail.position.set(fw.x, trailY, 0);
                        trail.visible = trailY > -7;
                        trail.material.opacity = 0.9 - index * 0.1;
                    });
                    
                    if (fw.y >= fw.targetY) {
                        fw.trail.forEach(t => {
                            t.visible = false;
                        });
                        explodeFirework(fw);
                    }
                } else {
                    let allDead = true;
                    
                    fw.particles.forEach(particle => {
                        if (particle.userData.life > 0) {
                            allDead = false;
                            
                            particle.position.x += particle.userData.vx;
                            particle.position.y += particle.userData.vy;
                            particle.position.z += particle.userData.vz;
                            
                            particle.userData.vy -= particle.userData.gravity;
                            
                            particle.userData.vx *= particle.userData.drag;
                            particle.userData.vy *= particle.userData.drag;
                            particle.userData.vz *= particle.userData.drag;
                            
                            particle.userData.life -= particle.userData.decay;
                            particle.material.opacity = Math.max(0, particle.userData.life);
                            
                            const scale = 0.5 + particle.userData.life * 0.5;
                            particle.scale.set(scale, scale, scale);
                        }
                    });
                    
                    fw.blessingSprites.forEach(sprite => {
                        if (sprite.userData.life > 0) {
                            allDead = false;
                            
                            sprite.position.y += sprite.userData.vy;
                            sprite.userData.life -= sprite.userData.decay;
                            sprite.material.opacity = Math.max(0, sprite.userData.life);
                            
                            const scale = 2.5 * (0.8 + sprite.userData.life * 0.2);
                            sprite.scale.set(scale, scale, 1);
                        }
                    });
                    
                    if (allDead) {
                        fw.particles.forEach(p => scene.remove(p));
                        fw.blessingSprites.forEach(s => scene.remove(s));
                        fireworks.splice(i, 1);
                    }
                }
            }
        }

        function updateStars() {
            stars.forEach(star => {
                const twinkle = Math.sin(time * star.userData.twinkleSpeed + star.userData.twinkleOffset);
                star.material.opacity = star.userData.baseOpacity * (0.4 + twinkle * 0.6);
                
                star.position.x = star.userData.baseX + currentOffsetX * 3;
                star.position.y = star.userData.baseY + currentOffsetY * 3;
            });
        }

        function updateFishes() {
            for (let i = fishes.length - 1; i >= 0; i--) {
                const fish = fishes[i];
                
                fish.mesh.position.x += fish.vx;
                fish.mesh.position.y += fish.vy;
                fish.vy -= fish.gravity;
                
                fish.tailPhase += 0.35;
                fish.tailGroup.rotation.y = Math.sin(fish.tailPhase) * 0.7;
                
                fish.mesh.rotation.z = Math.atan2(fish.vy, Math.abs(fish.vx)) * 0.5;
                
                if (fish.mesh.position.y > fish.waterLevel && fish.inWater) {
                    fish.inWater = false;
                    fish.jumped = true;
                    createRipple(fish.mesh.position.x, fish.waterLevel, fish.depthZ + 1);
                    createRipple(fish.mesh.position.x, fish.waterLevel, fish.depthZ + 1);
                }
                
                if (fish.mesh.position.y < fish.waterLevel && fish.jumped && !fish.inWater) {
                    fish.inWater = true;
                    createRipple(fish.mesh.position.x, fish.waterLevel, fish.depthZ + 1);
                    createRipple(fish.mesh.position.x, fish.waterLevel, fish.depthZ + 1);
                }
                
                if (fish.mesh.position.y < fish.waterLevel - 2) {
                    scene.remove(fish.mesh);
                    fishes.splice(i, 1);
                }
            }
        }

        function updateRipples() {
            for (let i = ripples.length - 1; i >= 0; i--) {
                const ripple = ripples[i];
                
                ripple.radius += 0.03;
                ripple.opacity -= 0.008;
                
                if (ripple.opacity <= 0 || ripple.radius >= ripple.maxRadius) {
                    scene.remove(ripple.mesh);
                    ripples.splice(i, 1);
                } else {
                    ripple.mesh.geometry.dispose();
                    ripple.mesh.geometry = new THREE.RingGeometry(ripple.radius, ripple.radius + 0.05, 32);
                    ripple.mesh.material.opacity = ripple.opacity;
                }
            }
        }

        function updateParallax() {
            currentOffsetX += (targetOffsetX - currentOffsetX) * 0.08;
            currentOffsetY += (targetOffsetY - currentOffsetY) * 0.08;
            
            if (skyMesh) {
                skyMesh.position.x = currentOffsetX * 4;
                skyMesh.position.y = 18 + currentOffsetY * 4;
            }
            if (seaMesh) {
                seaMesh.position.x = currentOffsetX * 3;
                seaMesh.position.y = -2 + currentOffsetY * 3;
            }
            if (sandMesh) {
                sandMesh.position.x = currentOffsetX * 2;
                sandMesh.position.y = -14 + currentOffsetY * 2;
            }
            if (sandBorderMesh) {
                sandBorderMesh.position.x = currentOffsetX * 2;
                sandBorderMesh.position.y = currentOffsetY * 2;
            }
            if (cannon) {
                cannon.position.x = currentOffsetX * 2;
            }
        }

        function animateCannon() {
            if (!cannon) return;
            
            const now = Date.now();
            if (now - lastFireTime < 300) {
                const progress = (now - lastFireTime) / 300;
                cannonBulge = Math.sin(progress * Math.PI) * 0.15;
                
                cannon.scale.x = 1 + cannonBulge;
                cannon.scale.z = 1 + cannonBulge;
                cannon.scale.y = 1 - cannonBulge * 0.3;
            } else {
                cannon.scale.set(1, 1, 1);
            }
        }

        function animate() {
            time += 0.016;
            
            updateStars();
            updateFireworks();
            updateFishes();
            updateRipples();
            updateParallax();
            animateCannon();
            
            renderer.render(scene, camera);
            requestAnimationFrame(animate);
        }

        function onMouseMove(event) {
            const x = (event.clientX / window.innerWidth) * 2 - 1;
            const y = (event.clientY / window.innerHeight) * 2 - 1;
            
            targetOffsetX = x * 0.125;
            targetOffsetY = -y * 0.125;
        }

        function onClick(event) {
            if (!audioContext) {
                initAudio();
            }
            
            const now = Date.now();
            if (now - lastFireTime < 500) return;
            
            lastFireTime = now;
            showHint.value = false;
            
            const y = ((event.clientY / window.innerHeight) * 2 - 1) * 6 + 4;
            
            createFirework(Math.max(y, 0));
        }

        function onResize() {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }

        function scheduleFishSpawn() {
            setInterval(() => {
                if (Math.random() < 0.3 && fishes.length < 4) {
                    createFish();
                }
            }, 3000);
        }

        onMounted(() => {
            isMobile.value = checkMobile();
            
            if (!isMobile.value) {
                initThree();
                animate();
                scheduleFishSpawn();
                
                window.addEventListener('resize', onResize);
                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('click', onClick);
            }
        });

        onUnmounted(() => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('click', onClick);
        });

        return {
            canvasContainer,
            isMobile,
            showHint
        };
    }
}).mount('#app');
