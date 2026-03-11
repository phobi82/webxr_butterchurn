(function() {
	const tau = Math.PI * 2;
	// Scales horizontal buffer scrolling caused by head yaw.
	const headYawBufferShiftFactor = 0.8;
	// Scales vertical buffer scrolling caused by head pitch.
	const headPitchBufferShiftFactor = 0.8;

	const clampNumber = function(value, minValue, maxValue) {
		return Math.max(minValue, Math.min(maxValue, value));
	};

	const wrapUnit = function(value) {
		return value - Math.floor(value);
	};

	const unwrapAngle = function(angle, referenceAngle) {
		let unwrappedAngle = angle;
		while (unwrappedAngle - referenceAngle > Math.PI) {
			unwrappedAngle -= tau;
		}
		while (unwrappedAngle - referenceAngle < -Math.PI) {
			unwrappedAngle += tau;
		}
		return unwrappedAngle;
	};

	const extractForwardYawPitch = function(viewMatrix) {
		const forwardX = -viewMatrix[2];
		const forwardY = -viewMatrix[6];
		const forwardZ = -viewMatrix[10];
		const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
		return {
			yaw: Math.atan2(forwardX, -forwardZ),
			pitch: Math.atan2(forwardY, horizontalLength)
		};
	};

	const extractForwardYawPitchFromQuaternion = function(quaternion) {
		const forwardX = -(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y));
		const forwardY = -(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x));
		const forwardZ = -(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y));
		const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
		return {
			yaw: Math.atan2(forwardX, -forwardZ),
			pitch: Math.atan2(forwardY, horizontalLength)
		};
	};

	const extractProjectionFov = function(projectionMatrix) {
		const xScale = projectionMatrix[0] || 1;
		const yScale = projectionMatrix[5] || 1;
		const xOffset = projectionMatrix[8] || 0;
		const yOffset = projectionMatrix[9] || 0;
		const leftTangent = (xOffset - 1) / xScale;
		const rightTangent = (xOffset + 1) / xScale;
		const bottomTangent = (yOffset - 1) / yScale;
		const topTangent = (yOffset + 1) / yScale;
		return {
			horizontal: Math.atan(rightTangent) - Math.atan(leftTangent),
			vertical: Math.atan(topTangent) - Math.atan(bottomTangent)
		};
	};

	const createCanvasForSource = function(width, height) {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		canvas.style.display = "none";
		return canvas;
	};

	const defaultPresetName = "martin - mucus cervix";

	const createButterchurnPresetSource = function() {
		const butterchurnApi = window.butterchurn && window.butterchurn.createVisualizer ? window.butterchurn : window.butterchurn && window.butterchurn.default && window.butterchurn.default.createVisualizer ? window.butterchurn.default : null;
		const butterchurnPresetsApi = window.butterchurnPresets && window.butterchurnPresets.getPresets ? window.butterchurnPresets : window.butterchurnPresets && window.butterchurnPresets.default && window.butterchurnPresets.default.getPresets ? window.butterchurnPresets.default : null;
		return {
			canvas: null,
			visualizer: null,
			audioContext: null,
			audioNode: null,
			audioStream: null,
			activatedBool: false,
			presetNames: [],
			presetMap: {},
			currentPresetIndex: 0,
			currentWidth: 0,
			currentHeight: 0,
			lastRenderTimeSeconds: 0,
			init: function(width, height) {
				this.canvas = createCanvasForSource(width, height);
				this.currentWidth = width;
				this.currentHeight = height;
				this.presetMap = butterchurnPresetsApi ? butterchurnPresetsApi.getPresets() : {};
				this.presetNames = Object.keys(this.presetMap).sort();
				if (!butterchurnApi || !this.presetNames.length) {
					return;
				}
			},
			activate: function() {
				if (!butterchurnApi || !this.presetNames.length || this.activatedBool) {
					if (this.audioContext && this.audioContext.state === "suspended") {
						return this.audioContext.resume().catch(function() {
						});
					}
					return Promise.resolve();
				}
				this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
				this.visualizer = butterchurnApi.createVisualizer(this.audioContext, this.canvas, {
					width: this.currentWidth,
					height: this.currentHeight,
					meshWidth: 32,
					meshHeight: 24,
					pixelRatio: 1,
					textureRatio: 1
				});
				this.activatedBool = true;
				this.visualizer.setOutputAA(false);
				this.visualizer.setRendererSize(this.currentWidth, this.currentHeight, {
					meshWidth: 32,
					meshHeight: 24,
					pixelRatio: 1,
					textureRatio: 1
				});
				this.visualizer.setInternalMeshSize(32, 24);
				this.selectPreset(Math.max(0, this.presetNames.indexOf(defaultPresetName)), 0);
				if (this.audioStream) {
					this.setAudioStream(this.audioStream);
				}
				if (this.audioContext.state === "suspended") {
					return this.audioContext.resume().catch(function() {
					});
				}
				return Promise.resolve();
			},
			ensureSize: function(width, height) {
				width = Math.max(1, width | 0);
				height = Math.max(1, height | 0);
				if (!this.canvas || width === this.currentWidth && height === this.currentHeight) {
					return;
				}
				this.currentWidth = width;
				this.currentHeight = height;
				this.canvas.width = width;
				this.canvas.height = height;
				if (this.visualizer) {
					this.visualizer.setRendererSize(width, height, {
						meshWidth: 32,
						meshHeight: 24,
						pixelRatio: 1,
						textureRatio: 1
					});
				}
			},
			setAudioStream: function(stream) {
				this.audioStream = stream;
				if (!this.visualizer || !this.audioContext) {
					return;
				}
				if (this.audioNode) {
					try {
						this.visualizer.disconnectAudio(this.audioNode);
					} catch (error) {
					}
					this.audioNode = null;
				}
				if (!stream) {
					return;
				}
				this.audioNode = this.audioContext.createMediaStreamSource(stream);
				this.visualizer.connectAudio(this.audioNode);
			},
			selectPreset: function(index, blendTimeSeconds) {
				if (!this.presetNames.length || !this.visualizer) {
					return Promise.resolve();
				}
				this.currentPresetIndex = (index + this.presetNames.length) % this.presetNames.length;
				this.visualizer.loadPreset(this.presetMap[this.presetNames[this.currentPresetIndex]], blendTimeSeconds || 0);
				return Promise.resolve();
			},
			render: function(timeSeconds) {
				if (!this.visualizer) {
					return;
				}
				let elapsedTimeSeconds = 1 / 60;
				if (this.lastRenderTimeSeconds > 0) {
					elapsedTimeSeconds = clampNumber(timeSeconds - this.lastRenderTimeSeconds, 1 / 240, 0.25);
				}
				this.lastRenderTimeSeconds = timeSeconds;
				this.visualizer.render({elapsedTime: elapsedTimeSeconds});
			},
			getCurrentTextureSource: function() {
				return this.canvas;
			},
			getPresetNames: function() {
				return this.presetNames.slice();
			},
			getCurrentPresetIndex: function() {
				return this.currentPresetIndex;
			},
			onSessionStart: function() {
				this.activate();
			},
			onSessionEnd: function() {
			}
		};
	};

	window.createToroidalBackgroundRenderer = function() {
		const quadVertexSource = [
			"attribute vec2 position;",
			"varying vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join("");

		const quadFragmentSource = [
			"precision highp float;",
			"uniform sampler2D sourceTexture;",
			"uniform vec2 viewportSize;",
			"uniform vec2 eyeCenterOffset;",
			"uniform vec2 orientationOffset;",
			"varying vec2 vScreenUv;",
			"float mirrorRepeat(float value){",
			"float wrapped=value-floor(value*0.5)*2.0;",
			"return wrapped<=1.0?wrapped:2.0-wrapped;",
			"}",
			"void main(){",
			"vec2 texel=(floor((vScreenUv-eyeCenterOffset)*viewportSize)+vec2(0.5))/viewportSize;",
			"vec2 sampleUv=vec2(fract(texel.x+orientationOffset.x),mirrorRepeat(texel.y+orientationOffset.y));",
			"gl_FragColor=texture2D(sourceTexture,sampleUv);",
			"}"
		].join("");

		return {
			gl: null,
			program: null,
			positionBuffer: null,
			positionLoc: null,
			sourceTextureLoc: null,
			viewportSizeLoc: null,
			eyeCenterOffsetLoc: null,
			orientationOffsetLoc: null,
			sourceTexture: null,
			source: null,
			lastUpdateTimeSeconds: 0,
			sourceDirtyBool: true,
			sourceWidth: 0,
			sourceHeight: 0,
			textureWidth: 0,
			textureHeight: 0,
			headYaw: 0,
			lastRawHeadYaw: null,
			headPitch: 0,
			headHorizontalFov: Math.PI / 2,
			headVerticalFov: Math.PI / 2,
			eyeCenterOffsetX: 0,
			eyeCenterOffsetY: 0,
			init: function(options) {
				this.gl = options.gl;
				this.program = this.createProgram(quadVertexSource, quadFragmentSource);
				this.positionLoc = this.gl.getAttribLocation(this.program, "position");
				this.sourceTextureLoc = this.gl.getUniformLocation(this.program, "sourceTexture");
				this.viewportSizeLoc = this.gl.getUniformLocation(this.program, "viewportSize");
				this.eyeCenterOffsetLoc = this.gl.getUniformLocation(this.program, "eyeCenterOffset");
				this.orientationOffsetLoc = this.gl.getUniformLocation(this.program, "orientationOffset");
				this.positionBuffer = this.gl.createBuffer();
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
				this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
					-1, -1,
					3, -1,
					-1, 3
				]), this.gl.STATIC_DRAW);
				this.sourceTexture = this.gl.createTexture();
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
				this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
				this.source = createButterchurnPresetSource();
				this.source.init(1, 1);
				this.sourceDirtyBool = true;
			},
			createShader: function(type, source) {
				const shader = this.gl.createShader(type);
				this.gl.shaderSource(shader, source);
				this.gl.compileShader(shader);
				if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
					throw new Error(this.gl.getShaderInfoLog(shader) || "Toroidal background shader compile failed");
				}
				return shader;
			},
			createProgram: function(vertexSource, fragmentSource) {
				const program = this.gl.createProgram();
				this.gl.attachShader(program, this.createShader(this.gl.VERTEX_SHADER, vertexSource));
				this.gl.attachShader(program, this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource));
				this.gl.linkProgram(program);
				if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
					throw new Error(this.gl.getProgramInfoLog(program) || "Toroidal background program link failed");
				}
				return program;
			},
			ensureSourceSize: function(width, height) {
				width = Math.max(1, width | 0);
				height = Math.max(1, height | 0);
				if (width === this.sourceWidth && height === this.sourceHeight) {
					return;
				}
				this.sourceWidth = width;
				this.sourceHeight = height;
				this.textureWidth = width;
				this.textureHeight = height;
				this.source.ensureSize(width, height);
				this.sourceDirtyBool = true;
			},
			updateSourceTexture: function() {
				const sourceCanvas = this.source.getCurrentTextureSource();
				if (!sourceCanvas) {
					return;
				}
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
				this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
				this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
				this.sourceDirtyBool = false;
			},
			update: function(timeSeconds) {
				this.lastUpdateTimeSeconds = timeSeconds;
				this.sourceDirtyBool = true;
			},
			setViewFromMatrix: function(viewMatrix, projectionMatrix) {
				const forwardAngles = extractForwardYawPitch(viewMatrix);
				const fov = extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				this.headPitch = forwardAngles.pitch;
				this.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				this.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadPoseFromQuaternion: function(quaternion, projectionMatrix) {
				const forwardAngles = extractForwardYawPitchFromQuaternion(quaternion);
				const fov = extractProjectionFov(projectionMatrix);
				this.setHeadYaw(forwardAngles.yaw);
				this.headPitch = forwardAngles.pitch;
				this.headHorizontalFov = Math.max(0.0001, fov.horizontal);
				this.headVerticalFov = Math.max(0.0001, fov.vertical);
				this.setEyeProjection(projectionMatrix);
			},
			setHeadYaw: function(rawYaw) {
				if (this.lastRawHeadYaw === null) {
					this.headYaw = rawYaw;
				} else {
					this.headYaw = unwrapAngle(rawYaw, this.lastRawHeadYaw) + (this.headYaw - this.lastRawHeadYaw);
				}
				this.lastRawHeadYaw = rawYaw;
			},
			setEyeProjection: function(projectionMatrix) {
				this.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
				this.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
			},
			draw: function() {
				const viewport = this.gl.getParameter(this.gl.VIEWPORT);
				const width = viewport[2];
				const height = viewport[3];
				this.ensureSourceSize(width, height);
				if (this.sourceDirtyBool) {
					this.source.render(this.lastUpdateTimeSeconds);
					this.updateSourceTexture();
				}
				const offsetX = wrapUnit(this.headYaw * headYawBufferShiftFactor / this.headHorizontalFov);
				const offsetY = clampNumber(this.headPitch * headPitchBufferShiftFactor / this.headVerticalFov, -1000, 1000);
				this.gl.disable(this.gl.DEPTH_TEST);
				this.gl.disable(this.gl.CULL_FACE);
				this.gl.useProgram(this.program);
				this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
				this.gl.enableVertexAttribArray(this.positionLoc);
				this.gl.vertexAttribPointer(this.positionLoc, 2, this.gl.FLOAT, false, 0, 0);
				this.gl.activeTexture(this.gl.TEXTURE0);
				this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
				this.gl.uniform1i(this.sourceTextureLoc, 0);
				this.gl.uniform2f(this.viewportSizeLoc, width, height);
				this.gl.uniform2f(this.eyeCenterOffsetLoc, this.eyeCenterOffsetX, this.eyeCenterOffsetY);
				this.gl.uniform2f(this.orientationOffsetLoc, offsetX, offsetY);
				this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
				this.gl.enable(this.gl.DEPTH_TEST);
				this.gl.enable(this.gl.CULL_FACE);
			},
			setAudioStream: function(stream) {
				this.source.setAudioStream(stream);
			},
			activateAudio: function() {
				return this.source.activate();
			},
			getPresetNames: function() {
				return this.source.getPresetNames();
			},
			getCurrentPresetIndex: function() {
				return this.source.getCurrentPresetIndex();
			},
			selectPreset: function(index) {
				const renderer = this;
				return this.source.selectPreset(index, 1.2).then(function() {
					renderer.source.lastRenderTimeSeconds = 0;
					renderer.sourceDirtyBool = true;
				});
			},
			onSessionStart: function() {
				this.source.onSessionStart();
			},
			onSessionEnd: function() {
				this.source.onSessionEnd();
			}
		};
	};
})();
