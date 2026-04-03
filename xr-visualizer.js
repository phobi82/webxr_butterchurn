// Visualizer modes and engine.

// Modes

const headYawBufferShiftFactor = 0.8;
const headPitchBufferShiftFactor = 0.8;
const fullTurnRadians = Math.PI * 2;
const skysphereHorizontalRepeatCount = 4;
const visualizerBackgroundCompositeShaderChunk = [
	"uniform float backgroundMaskCount;",
	"uniform vec2 backgroundMaskCenters[2];",
	"uniform vec2 backgroundMaskParams[2];",
	"float circleReveal(vec2 uv, vec2 center, vec2 params){",
	"float radius=max(params.x,0.0001);",
	"float softness=max(params.y,0.0001);",
	"float inner=max(0.0,radius-softness);",
	"return 1.0-smoothstep(inner,radius,distance(uv,center));",
	"}",
	"float computeBackgroundAlpha(vec2 screenUv,float uniformAlpha){",
	"float reveal=0.0;",
	"for(int i=0;i<2;i+=1){",
	"if(float(i)>=backgroundMaskCount){break;}",
	"float localReveal=circleReveal(screenUv,backgroundMaskCenters[i],backgroundMaskParams[i]);",
	"reveal=1.0-(1.0-reveal)*(1.0-localReveal);",
	"}",
	"return clamp(uniformAlpha*(1.0-reveal),0.0,1.0);",
	"}"
].join("");

const toroidalFragmentSource = [
	"precision highp float;",
	"uniform sampler2D sourceTexture;",
	"uniform vec2 viewportSize;",
	"uniform vec2 eyeCenterOffset;",
	"uniform vec2 orientationOffset;",
	"uniform float horizontalMirror;",
	"uniform float backgroundAlpha;",
	visualizerBackgroundCompositeShaderChunk,
	"varying vec2 vScreenUv;",
	"float mirrorRepeat(float value){",
	"float wrapped=value-floor(value*0.5)*2.0;",
	"return wrapped<=1.0?wrapped:2.0-wrapped;",
	"}",
	"void main(){",
	"vec2 texel=(floor((vScreenUv-eyeCenterOffset)*viewportSize)+vec2(0.5))/viewportSize;",
	"float rawU=texel.x+orientationOffset.x;",
	"vec2 sampleUv=vec2(mix(fract(rawU),mirrorRepeat(rawU),horizontalMirror),mirrorRepeat(texel.y+orientationOffset.y));",
	"vec4 sampleColor=texture2D(sourceTexture,sampleUv);",
	"gl_FragColor=vec4(sampleColor.rgb,computeBackgroundAlpha(vScreenUv,backgroundAlpha));",
	"}"
].join("");

const toroidal = function() {
	let horizontalMirrorLoc = null;
	let base = createFullscreenTextureMode({
		label: "Toroidal mode",
		fragmentSource: toroidalFragmentSource,
		getOrientationOffset: function(sourceState, frameState) {
			return {
				x: wrapUnit(frameState.headYaw * headYawBufferShiftFactor / frameState.headHorizontalFov),
				y: clampNumber(frameState.headPitch * headPitchBufferShiftFactor / frameState.headVerticalFov, -1000, 1000)
			};
		},
		applyUniforms: function(gl, programInfo, sourceState, frameState) {
			gl.uniform1f(horizontalMirrorLoc, frameState.horizontalMirrorBool ? 1 : 0);
		}
	});
	let baseInit = base.init;
	base.init = function(options) {
		baseInit.call(this, options);
		horizontalMirrorLoc = this.gl.getUniformLocation(this.programInfo.program, "horizontalMirror");
	};
	return base;
};

const skysphereFragmentSource = [
	"precision highp float;",
	"uniform sampler2D sourceTexture;",
	"uniform vec3 camRight;",
	"uniform vec3 camUp;",
	"uniform vec3 camForward;",
	"uniform vec4 projParams;",
	"uniform vec2 texScale;",
	"uniform float horizontalMirror;",
	"uniform float backgroundAlpha;",
	visualizerBackgroundCompositeShaderChunk,
	"varying vec2 vScreenUv;",
	"float mirrorRepeat(float value){",
	"float wrapped=value-floor(value*0.5)*2.0;",
	"return wrapped<=1.0?wrapped:2.0-wrapped;",
	"}",
	"void main(){",
	"vec2 clip=vScreenUv*2.0-1.0;",
	"float vx=(clip.x+projParams.z)/projParams.x;",
	"float vy=(clip.y+projParams.w)/projParams.y;",
	"vec3 dir=normalize(camRight*vx+camUp*vy+camForward);",
	"float yaw=atan(dir.x,-dir.z);",
	"float pitch=asin(clamp(dir.y,-1.0,1.0));",
	"float rawU=yaw*texScale.x+0.5;",
	"vec2 uv=vec2(mix(fract(rawU),mirrorRepeat(rawU),horizontalMirror),mirrorRepeat(pitch*texScale.y+0.5));",
	"vec4 sampleColor=texture2D(sourceTexture,uv);",
	"gl_FragColor=vec4(sampleColor.rgb,computeBackgroundAlpha(vScreenUv,backgroundAlpha));",
	"}"
].join("");

const skysphere = function() {
	let camRightLoc = null;
	let camUpLoc = null;
	let camForwardLoc = null;
	let projParamsLoc = null;
	let texScaleLoc = null;
	let horizontalMirrorLoc = null;
	let base = createFullscreenTextureMode({
		label: "Skysphere mode",
		fragmentSource: skysphereFragmentSource,
		getSourceFrameSize: function(frameState, viewportWidth, viewportHeight) {
			const verticalFov = Math.max(0.0001, frameState.headVerticalFov || Math.PI / 2);
			const perRepeatHorizontalSpan = fullTurnRadians / skysphereHorizontalRepeatCount;
			return {
				width: Math.max(1, Math.round(viewportHeight * perRepeatHorizontalSpan / verticalFov)),
				height: Math.max(1, viewportHeight | 0)
			};
		},
		applyUniforms: function(gl, programInfo, sourceState, frameState) {
			let vm = frameState.viewMatrix;
			let pm = frameState.projMatrix;
			gl.uniform3f(camRightLoc, vm[0], vm[4], vm[8]);
			gl.uniform3f(camUpLoc, vm[1], vm[5], vm[9]);
			gl.uniform3f(camForwardLoc, -vm[2], -vm[6], -vm[10]);
			gl.uniform4f(projParamsLoc, pm[0], pm[5], pm[8], pm[9]);
			gl.uniform2f(texScaleLoc, skysphereHorizontalRepeatCount / fullTurnRadians, 1.0 / frameState.headVerticalFov);
			gl.uniform1f(horizontalMirrorLoc, frameState.horizontalMirrorBool ? 1 : 0);
		}
	});
	let baseInit = base.init;
	base.init = function(options) {
		baseInit.call(this, options);
		let program = this.programInfo.program;
		camRightLoc = this.gl.getUniformLocation(program, "camRight");
		camUpLoc = this.gl.getUniformLocation(program, "camUp");
		camForwardLoc = this.gl.getUniformLocation(program, "camForward");
		projParamsLoc = this.gl.getUniformLocation(program, "projParams");
		texScaleLoc = this.gl.getUniformLocation(program, "texScale");
		horizontalMirrorLoc = this.gl.getUniformLocation(program, "horizontalMirror");
	};
	return base;
};

const skyToroidFragmentSource = [
	"precision highp float;",
	"uniform sampler2D sourceTexture;",
	"uniform vec4 projParams;",
	"uniform vec2 headOrientation;",
	"uniform float headRoll;",
	"uniform vec2 texScale;",
	"uniform float horizontalMirror;",
	"uniform float backgroundAlpha;",
	visualizerBackgroundCompositeShaderChunk,
	"varying vec2 vScreenUv;",
	"float mirrorRepeat(float value){",
	"float wrapped=value-floor(value*0.5)*2.0;",
	"return wrapped<=1.0?wrapped:2.0-wrapped;",
	"}",
	"void main(){",
	"vec2 clip=vScreenUv*2.0-1.0;",
	"float vx=(clip.x+projParams.z)/projParams.x;",
	"float vy=(clip.y+projParams.w)/projParams.y;",
	"float cosR=cos(headRoll);",
	"float sinR=sin(headRoll);",
	"float corrVx=vx*cosR+vy*sinR;",
	"float corrVy=-vx*sinR+vy*cosR;",
	"float totalYaw=headOrientation.x+atan(corrVx,1.0);",
	"float totalPitch=headOrientation.y+atan(corrVy,1.0);",
	"float rawU=totalYaw*texScale.x+0.5;",
	"vec2 uv=vec2(mix(fract(rawU),mirrorRepeat(rawU),horizontalMirror),mirrorRepeat(totalPitch*texScale.y+0.5));",
	"vec4 sampleColor=texture2D(sourceTexture,uv);",
	"gl_FragColor=vec4(sampleColor.rgb,computeBackgroundAlpha(vScreenUv,backgroundAlpha));",
	"}"
].join("");

const skyToroid = function() {
	let projParamsLoc = null;
	let headOrientationLoc = null;
	let headRollLoc = null;
	let texScaleLoc = null;
	let horizontalMirrorLoc = null;
	let base = createFullscreenTextureMode({
		label: "Sky Toroid mode",
		fragmentSource: skyToroidFragmentSource,
		applyUniforms: function(gl, programInfo, sourceState, frameState) {
			let vm = frameState.viewMatrix;
			let pm = frameState.projMatrix;
			gl.uniform4f(projParamsLoc, pm[0], pm[5], pm[8], pm[9]);
			gl.uniform2f(headOrientationLoc, frameState.headYaw, frameState.headPitch);
			gl.uniform1f(headRollLoc, -Math.atan2(vm[4], vm[5]));
			gl.uniform2f(texScaleLoc, 1.0 / frameState.headHorizontalFov, 1.0 / frameState.headVerticalFov);
			gl.uniform1f(horizontalMirrorLoc, frameState.horizontalMirrorBool ? 1 : 0);
		}
	});
	let baseInit = base.init;
	base.init = function(options) {
		baseInit.call(this, options);
		let program = this.programInfo.program;
		projParamsLoc = this.gl.getUniformLocation(program, "projParams");
		headOrientationLoc = this.gl.getUniformLocation(program, "headOrientation");
		headRollLoc = this.gl.getUniformLocation(program, "headRoll");
		texScaleLoc = this.gl.getUniformLocation(program, "texScale");
		horizontalMirrorLoc = this.gl.getUniformLocation(program, "horizontalMirror");
	};
	return base;
};

const visualizerModeDefinitions = [
	{
		name: formatFunctionLabel(skysphere.name),
		create: skysphere
	},
	{
		name: formatFunctionLabel(skyToroid.name),
		create: skyToroid
	},
	{
		name: formatFunctionLabel(toroidal.name),
		create: toroidal
	}
];

// Fullscreen mode
const createFullscreenTextureMode = function(spec) {
	spec = spec || {};
	return {
		gl: null,
		sourceBackend: null,
		programInfo: null,
		positionBuffer: null,
		sourceTexture: null,
		lastUploadedCanvasVersion: -1,
		lastUploadedWidth: 0,
		lastUploadedHeight: 0,
		lastPreparedTimeSeconds: -1,
		lastPreparedWidth: 0,
		lastPreparedHeight: 0,
		init: function(options) {
			this.gl = options.gl;
			this.sourceBackend = options.sourceBackend;
			this.programInfo = createFullscreenProgramInfo(this.gl, spec.fragmentSource, !!spec.includeAudioUniformsBool, spec.label || "Visualizer mode");
			this.positionBuffer = createFullscreenTriangleBuffer(this.gl);
			this.sourceTexture = this.gl.createTexture();
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
			this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
		},
		uploadSourceTexture: function(sourceCanvas) {
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
			this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
			this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
		},
		update: function() {
		},
		onPresetChanged: function() {
			this.lastUploadedCanvasVersion = -1;
			this.lastPreparedTimeSeconds = -1;
		},
		onAudioChanged: function() {
			this.lastUploadedCanvasVersion = -1;
			this.lastPreparedTimeSeconds = -1;
		},
		prepareSourceFrame: function(sourceWidth, sourceHeight, timeSeconds) {
			this.sourceBackend.ensureCanvasSize(sourceWidth, sourceHeight);
			this.sourceBackend.advanceFrame(timeSeconds);
			if (this.lastPreparedTimeSeconds === timeSeconds && sourceWidth === this.lastPreparedWidth && sourceHeight === this.lastPreparedHeight) {
				return this.sourceBackend.getState();
			}
			this.sourceBackend.renderCanvas(timeSeconds);
			this.lastPreparedTimeSeconds = timeSeconds;
			this.lastPreparedWidth = sourceWidth;
			this.lastPreparedHeight = sourceHeight;
			return this.sourceBackend.getState();
		},
		drawPreScene: function(sourceState, frameState) {
			const viewport = this.gl.getParameter(this.gl.VIEWPORT);
			const width = viewport[2];
			const height = viewport[3];
			const sourceSize = spec.getSourceFrameSize ? spec.getSourceFrameSize(frameState, width, height) : null;
			const sourceWidth = Math.max(1, sourceSize && sourceSize.width ? sourceSize.width | 0 : width | 0);
			const sourceHeight = Math.max(1, sourceSize && sourceSize.height ? sourceSize.height | 0 : height | 0);
			sourceState = this.prepareSourceFrame(sourceWidth, sourceHeight, frameState.timeSeconds);
			const sourceCanvas = sourceState.textureSource;
			if (!sourceCanvas) {
				return;
			}
			if (sourceState.canvasRenderVersion !== this.lastUploadedCanvasVersion || sourceWidth !== this.lastUploadedWidth || sourceHeight !== this.lastUploadedHeight) {
				this.uploadSourceTexture(sourceCanvas);
				this.lastUploadedCanvasVersion = sourceState.canvasRenderVersion;
				this.lastUploadedWidth = sourceWidth;
				this.lastUploadedHeight = sourceHeight;
			}
			const orientationOffset = spec.getOrientationOffset ? spec.getOrientationOffset(sourceState, frameState) : {x: 0, y: 0};
			this.gl.disable(this.gl.DEPTH_TEST);
			this.gl.disable(this.gl.CULL_FACE);
			this.gl.useProgram(this.programInfo.program);
			this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
			this.gl.enableVertexAttribArray(this.programInfo.positionLoc);
			this.gl.vertexAttribPointer(this.programInfo.positionLoc, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.activeTexture(this.gl.TEXTURE0);
			this.gl.bindTexture(this.gl.TEXTURE_2D, this.sourceTexture);
			this.gl.uniform1i(this.programInfo.sourceTextureLoc, 0);
			this.gl.uniform2f(this.programInfo.viewportSizeLoc, width, height);
			this.gl.uniform2f(this.programInfo.eyeCenterOffsetLoc, frameState.eyeCenterOffsetX, frameState.eyeCenterOffsetY);
			this.gl.uniform2f(this.programInfo.orientationOffsetLoc, orientationOffset.x, orientationOffset.y);
			if (this.programInfo.backgroundAlphaLoc) {
				this.gl.uniform1f(this.programInfo.backgroundAlphaLoc, frameState.backgroundAlpha);
			}
			if (this.programInfo.backgroundMaskCountLoc) {
				this.gl.uniform1f(this.programInfo.backgroundMaskCountLoc, frameState.backgroundMaskCount);
			}
			if (this.programInfo.backgroundMaskCentersLoc) {
				this.gl.uniform2fv(this.programInfo.backgroundMaskCentersLoc, frameState.backgroundMaskCenters);
			}
			if (this.programInfo.backgroundMaskParamsLoc) {
				this.gl.uniform2fv(this.programInfo.backgroundMaskParamsLoc, frameState.backgroundMaskParams);
			}
			if (this.programInfo.audioMetricsLoc) {
				const audioMetrics = sourceState.audioMetrics || {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
				this.gl.uniform4f(this.programInfo.audioMetricsLoc, audioMetrics.level, audioMetrics.peak, audioMetrics.bass, audioMetrics.transient);
			}
			if (this.programInfo.beatPulseLoc) {
				this.gl.uniform1f(this.programInfo.beatPulseLoc, sourceState.audioMetrics ? sourceState.audioMetrics.beatPulse : 0);
			}
			if (spec.applyUniforms) {
				spec.applyUniforms(this.gl, this.programInfo, sourceState, frameState);
			}
			this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
			this.gl.enable(this.gl.DEPTH_TEST);
			this.gl.enable(this.gl.CULL_FACE);
		}
	};
};

// Engine
const createVisualizerFrameState = function() {
	return {
		timeSeconds: 0,
		headYaw: 0,
		headPitch: 0,
		horizontalMirrorBool: true,
		headHorizontalFov: Math.PI / 2,
		headVerticalFov: Math.PI / 2,
		backgroundAlpha: 1,
		backgroundMaskCount: 0,
		backgroundMaskCenters: new Float32Array(4),
		backgroundMaskParams: new Float32Array(4),
		headPositionX: 0,
		headPositionY: 0,
		headPositionZ: 0,
		eyeCenterOffsetX: 0,
		eyeCenterOffsetY: 0,
		viewMatrix: new Float32Array(16),
		projMatrix: new Float32Array(16),
		lastRawHeadYaw: undefined
	};
};

const setVisualizerHeadYaw = function(frameState, rawYaw) {
	if (frameState.lastRawHeadYaw === undefined) {
		frameState.headYaw = rawYaw;
	} else {
		frameState.headYaw = unwrapAngle(rawYaw, frameState.lastRawHeadYaw) + (frameState.headYaw - frameState.lastRawHeadYaw);
	}
	frameState.lastRawHeadYaw = rawYaw;
};

const setVisualizerProjectionState = function(frameState, projectionMatrix) {
	frameState.projMatrix.set(projectionMatrix);
	frameState.eyeCenterOffsetX = -(projectionMatrix[8] || 0) * 0.5;
	frameState.eyeCenterOffsetY = -(projectionMatrix[9] || 0) * 0.5;
};

const applyVisualizerRenderView = function(frameState, viewMatrix, projectionMatrix) {
	frameState.viewMatrix.set(viewMatrix);
	setVisualizerProjectionState(frameState, projectionMatrix);
};

const applyVisualizerPreviewView = function(frameState, viewMatrix, projectionMatrix) {
	const forwardAngles = extractForwardYawPitch(viewMatrix);
	const cameraPosition = extractCameraPositionFromViewMatrix(viewMatrix);
	const fov = extractProjectionFov(projectionMatrix);
	applyVisualizerRenderView(frameState, viewMatrix, projectionMatrix);
	setVisualizerHeadYaw(frameState, forwardAngles.yaw);
	frameState.headPitch = forwardAngles.pitch;
	frameState.headPositionX = cameraPosition.x;
	frameState.headPositionY = cameraPosition.y;
	frameState.headPositionZ = cameraPosition.z;
	frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
	frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
};

const applyVisualizerHeadPose = function(frameState, quaternion, projectionMatrix) {
	const forwardAngles = extractForwardYawPitchFromQuaternion(quaternion);
	const fov = extractProjectionFov(projectionMatrix);
	setVisualizerHeadYaw(frameState, forwardAngles.yaw);
	frameState.headPitch = forwardAngles.pitch;
	frameState.headHorizontalFov = Math.max(0.0001, fov.horizontal);
	frameState.headVerticalFov = Math.max(0.0001, fov.vertical);
	setVisualizerProjectionState(frameState, projectionMatrix);
};

const setVisualizerBackgroundCompositeState = function(frameState, backgroundCompositeState) {
	backgroundCompositeState = backgroundCompositeState || {};
	frameState.backgroundAlpha = clampNumber(backgroundCompositeState.alpha == null ? 1 : backgroundCompositeState.alpha, 0, 1);
	frameState.backgroundMaskCount = clampNumber(backgroundCompositeState.maskCount || 0, 0, 2);
	for (let i = 0; i < frameState.backgroundMaskCenters.length; i += 1) {
		frameState.backgroundMaskCenters[i] = 0;
		frameState.backgroundMaskParams[i] = 0;
	}
	for (let i = 0; i < frameState.backgroundMaskCount; i += 1) {
		const mask = backgroundCompositeState.masks[i];
		if (!mask) {
			continue;
		}
		frameState.backgroundMaskCenters[i * 2] = mask.x;
		frameState.backgroundMaskCenters[i * 2 + 1] = mask.y;
		frameState.backgroundMaskParams[i * 2] = mask.radius;
		frameState.backgroundMaskParams[i * 2 + 1] = mask.softness;
	}
};

const createVisualizerModeRegistry = function(modeDefinitions, gl, sourceBackend) {
	const modeNames = [];
	const modes = {};
	for (let i = 0; i < modeDefinitions.length; i += 1) {
		const definition = modeDefinitions[i];
		const mode = definition.create({gl: gl, sourceBackend: sourceBackend});
		if (!mode) {
			continue;
		}
		if (mode.init) {
			mode.init({gl: gl, sourceBackend: sourceBackend});
		}
		modeNames.push(definition.name);
		modes[definition.name] = mode;
	}
	return {
		modeNames: modeNames,
		modes: modes
	};
};

const resolvedVisualizerActionPromise = Promise.resolve();

const createVisualizerEngineDispatch = function(engine, frameState) {
	const getSourceState = function() {
		return engine.sourceBackend.getState();
	};
	const getActiveMode = function() {
		return engine.modes[engine.modeNames[engine.currentModeIndex]] || null;
	};
	return {
		getSourceState: getSourceState,
		getActiveMode: getActiveMode,
		notifyModes: function(methodName) {
			const sourceState = getSourceState();
			for (let i = 0; i < engine.modeNames.length; i += 1) {
				const mode = engine.modes[engine.modeNames[i]];
				if (mode && mode[methodName]) {
					mode[methodName](sourceState, frameState);
				}
			}
		},
		drawPhase: function(methodName) {
			const mode = getActiveMode();
			if (!mode || !mode[methodName]) {
				return;
			}
			mode[methodName](getSourceState(), frameState);
		}
	};
};

const createVisualizerEngine = function(options) {
	const modeDefinitions = options.modes || [];
	const frameState = createVisualizerFrameState();
	const engine = {
		gl: null,
		sourceBackend: null,
		modeNames: [],
		modes: {},
		currentModeIndex: 0
	};
	const dispatch = createVisualizerEngineDispatch(engine, frameState);
	const init = function(args) {
		const modeRegistry = createVisualizerModeRegistry(modeDefinitions, args.gl, args.sourceBackend);
		engine.gl = args.gl;
		engine.sourceBackend = args.sourceBackend;
		engine.sourceBackend.init(args.gl.drawingBufferWidth || 512, args.gl.drawingBufferHeight || 512);
		engine.modeNames = modeRegistry.modeNames;
		engine.modes = modeRegistry.modes;
		if (engine.currentModeIndex >= engine.modeNames.length) {
			engine.currentModeIndex = 0;
		}
	};
	const update = function(timeSeconds) {
		frameState.timeSeconds = timeSeconds;
		engine.sourceBackend.advanceFrame(timeSeconds);
		const activeMode = dispatch.getActiveMode();
		if (activeMode && activeMode.update) {
			activeMode.update(dispatch.getSourceState(), frameState);
		}
	};
	const setBackgroundCompositeState = function(backgroundCompositeState) {
		setVisualizerBackgroundCompositeState(frameState, backgroundCompositeState);
	};
	const getSelectionState = function() {
		return {
			modeNames: engine.modeNames.slice(),
			currentModeIndex: engine.currentModeIndex,
			horizontalMirrorBool: !!frameState.horizontalMirrorBool,
			presetNames: engine.sourceBackend.getPresetNames(),
			currentPresetIndex: engine.sourceBackend.getCurrentPresetIndex()
		};
	};
	const selectPreset = async function(index) {
		await engine.sourceBackend.selectPreset(index, 1.2);
		engine.sourceBackend.lastCanvasRenderTimeSeconds = 0;
		dispatch.notifyModes("onPresetChanged");
	};
	const selectMode = function(index) {
		if (!engine.modeNames.length) {
			return resolvedVisualizerActionPromise;
		}
		engine.currentModeIndex = (index + engine.modeNames.length) % engine.modeNames.length;
		return resolvedVisualizerActionPromise;
	};
	const toggleHorizontalMirror = function() {
		frameState.horizontalMirrorBool = !frameState.horizontalMirrorBool;
		return resolvedVisualizerActionPromise;
	};
	const startSession = function() {
		engine.sourceBackend.startSession();
		dispatch.notifyModes("onSessionStart");
	};
	const endSession = function() {
		engine.sourceBackend.endSession();
		dispatch.notifyModes("onSessionEnd");
	};
	return Object.assign(engine, {
		init: init,
		update: update,
		setRenderView: function(viewMatrix, projectionMatrix) {
			applyVisualizerRenderView(frameState, viewMatrix, projectionMatrix);
		},
		setPreviewView: function(viewMatrix, projectionMatrix) {
			applyVisualizerPreviewView(frameState, viewMatrix, projectionMatrix);
		},
		setHeadPoseFromQuaternion: function(quaternion, projectionMatrix) {
			applyVisualizerHeadPose(frameState, quaternion, projectionMatrix);
		},
		setHeadPosition: function(x, y, z) {
			frameState.headPositionX = x;
			frameState.headPositionY = y;
			frameState.headPositionZ = z;
		},
		setBackgroundCompositeState: setBackgroundCompositeState,
		setBackgroundBlend: function(passthroughMix, passthroughAvailableBool) {
			setBackgroundCompositeState({
				alpha: passthroughAvailableBool ? clampNumber(1 - (passthroughMix || 0), 0, 1) : 1,
				maskCount: 0,
				masks: []
			});
		},
		drawPreScene: function() {
			dispatch.drawPhase("drawPreScene");
		},
		drawWorld: function() {
			dispatch.drawPhase("drawWorld");
		},
		drawPostScene: function() {
			dispatch.drawPhase("drawPostScene");
		},
		setAudioStream: function(stream) {
			engine.sourceBackend.setAudioStream(stream);
			dispatch.notifyModes("onAudioChanged");
		},
		startDebugAudio: async function() {
			await engine.sourceBackend.startDebugAudio();
			dispatch.notifyModes("onAudioChanged");
		},
		activateAudio: function() {
			return engine.sourceBackend.activate();
		},
		getAudioMetrics: function() {
			return engine.sourceBackend.getAudioMetrics ? engine.sourceBackend.getAudioMetrics() : emptyAudioMetrics;
		},
		getSelectionState: getSelectionState,
		selectPreset: selectPreset,
		selectMode: selectMode,
		toggleHorizontalMirror: toggleHorizontalMirror,
		startSession: startSession,
		endSession: endSession
	});
};

// Butterchurn source
const defaultPresetName = "martin - mucus cervix";

const createButterchurnCanvasElement = function(documentRef, width, height) {
	const canvas = documentRef.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	canvas.style.display = "none";
	return canvas;
};

const createButterchurnSourceState = function() {
	return {
		canvas: null,
		visualizer: null,
		audioContext: null,
		audioNode: null,
		audioStream: null,
		audioSourceKind: "none",
		activatedBool: false,
		presetNames: [],
		presetMap: {},
		currentPresetIndex: 0,
		currentWidth: 0,
		currentHeight: 0,
		currentTimeSeconds: 0,
		lastCanvasRenderTimeSeconds: 0,
		presetVersion: 0,
		audioVersion: 0,
		canvasRenderVersion: 0
	};
};

const initButterchurnPresetLibrary = function(source, butterchurnPresetsApi) {
	source.presetMap = butterchurnPresetsApi ? butterchurnPresetsApi.getPresets() : {};
	source.presetNames = Object.keys(source.presetMap).sort();
	source.currentPresetIndex = Math.max(0, source.presetNames.indexOf(defaultPresetName));
	source.presetVersion = 1;
};

const resolvedButterchurnReadyPromise = Promise.resolve();

const attachButterchurnAudioNode = function(source, audioAnalyser, node) {
	audioAnalyser.ensureNodes(source.audioContext);
	source.audioNode = node;
	audioAnalyser.connectSource(source.audioNode);
	source.visualizer.connectAudio(source.audioNode);
};

const disconnectButterchurnAudioInput = function(source, audioAnalyser) {
	if (source.audioNode) {
		try { source.visualizer.disconnectAudio(source.audioNode); } catch (error) {}
		try { source.audioNode.disconnect(); } catch (error) {}
		source.audioNode = null;
	}
	audioAnalyser.destroyDebugAudioNodes();
};

const syncButterchurnAudioInput = function(source, audioAnalyser) {
	if (!source.visualizer || !source.audioContext) {
		if (!source.audioStream && source.audioSourceKind !== "debug") {
			audioAnalyser.resetMetrics();
		}
		return resolvedButterchurnReadyPromise;
	}
	disconnectButterchurnAudioInput(source, audioAnalyser);
	if (source.audioSourceKind === "debug") {
		const debugNodes = audioAnalyser.createDebugAudioNodes(source.audioContext);
		attachButterchurnAudioNode(source, audioAnalyser, debugNodes.inputNode);
		return resolvedButterchurnReadyPromise;
	}
	if (!source.audioStream) {
		audioAnalyser.resetMetrics();
		return resolvedButterchurnReadyPromise;
	}
	attachButterchurnAudioNode(source, audioAnalyser, source.audioContext.createMediaStreamSource(source.audioStream));
	return resolvedButterchurnReadyPromise;
};

const activateButterchurnBackend = function(source, audioContextCtor, butterchurnApi) {
	if (!butterchurnApi || !source.presetNames.length || source.activatedBool) {
		if (source.audioContext && source.audioContext.state === "suspended") {
			return source.audioContext.resume().catch(function() {});
		}
		return resolvedButterchurnReadyPromise;
	}
	source.audioContext = new audioContextCtor();
	source.visualizer = butterchurnApi.createVisualizer(source.audioContext, source.canvas, {
		width: source.currentWidth,
		height: source.currentHeight,
		meshWidth: 32,
		meshHeight: 24,
		pixelRatio: 1,
		textureRatio: 1
	});
	source.activatedBool = true;
	source.visualizer.setOutputAA(false);
	source.visualizer.setRendererSize(source.currentWidth, source.currentHeight, {meshWidth: 32, meshHeight: 24, pixelRatio: 1, textureRatio: 1});
	source.visualizer.setInternalMeshSize(32, 24);
	return resolvedButterchurnReadyPromise;
};

const createButterchurnSource = function(options) {
	options = options || {};
	const windowRef = options.windowRef || window;
	const documentRef = options.documentRef || document;
	const audioContextCtor = options.audioContextCtor || windowRef.AudioContext || windowRef.webkitAudioContext;
	const butterchurnApi = options.butterchurnApi || (windowRef.butterchurn && windowRef.butterchurn.createVisualizer ? windowRef.butterchurn : windowRef.butterchurn && windowRef.butterchurn.default && windowRef.butterchurn.default.createVisualizer ? windowRef.butterchurn.default : null);
	const butterchurnPresetsApi = options.butterchurnPresetsApi || (windowRef.butterchurnPresets && windowRef.butterchurnPresets.getPresets ? windowRef.butterchurnPresets : windowRef.butterchurnPresets && windowRef.butterchurnPresets.default && windowRef.butterchurnPresets.default.getPresets ? windowRef.butterchurnPresets.default : null);
	const audioAnalyser = createAudioAnalyser();
	const source = createButterchurnSourceState();
	Object.assign(source, {
		init: function(width, height) {
			this.canvas = createButterchurnCanvasElement(documentRef, width, height);
			this.currentWidth = width;
			this.currentHeight = height;
			initButterchurnPresetLibrary(this, butterchurnPresetsApi);
		},
		advanceFrame: function(timeSeconds) {
			this.currentTimeSeconds = typeof timeSeconds === "number" ? timeSeconds : 0;
			audioAnalyser.advanceFrame(this.currentTimeSeconds);
		},
		activate: async function() {
			await activateButterchurnBackend(this, audioContextCtor, butterchurnApi);
			if (!this.visualizer) {
				return resolvedButterchurnReadyPromise;
			}
			await this.selectPreset(this.currentPresetIndex, 0);
			await syncButterchurnAudioInput(this, audioAnalyser);
			if (this.audioContext && this.audioContext.state === "suspended") {
				return this.audioContext.resume().catch(function() {});
			}
			return resolvedButterchurnReadyPromise;
		},
		ensureCanvasSize: function(width, height) {
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
				this.visualizer.setRendererSize(width, height, {meshWidth: 32, meshHeight: 24, pixelRatio: 1, textureRatio: 1});
			}
		},
		setAudioStream: function(stream) {
			if (this.audioSourceKind !== "stream" || this.audioStream !== stream) {
				this.audioVersion += 1;
			}
			this.audioStream = stream;
			this.audioSourceKind = stream ? "stream" : "none";
			syncButterchurnAudioInput(this, audioAnalyser);
		},
		startDebugAudio: function() {
			if (this.audioSourceKind !== "debug") {
				this.audioVersion += 1;
			}
			this.audioStream = null;
			this.audioSourceKind = "debug";
			return syncButterchurnAudioInput(this, audioAnalyser);
		},
		selectPreset: function(index, blendTimeSeconds) {
			if (!this.presetNames.length) {
				return resolvedButterchurnReadyPromise;
			}
			const nextPresetIndex = (index + this.presetNames.length) % this.presetNames.length;
			if (nextPresetIndex !== this.currentPresetIndex) {
				this.currentPresetIndex = nextPresetIndex;
				this.presetVersion += 1;
			}
			if (!this.visualizer) {
				return resolvedButterchurnReadyPromise;
			}
			this.visualizer.loadPreset(this.presetMap[this.presetNames[this.currentPresetIndex]], blendTimeSeconds || 0);
			return resolvedButterchurnReadyPromise;
		},
		renderCanvas: function(timeSeconds) {
			this.advanceFrame(timeSeconds);
			if (!this.visualizer) {
				return;
			}
			let elapsedTimeSeconds = 1 / 60;
			if (this.lastCanvasRenderTimeSeconds > 0) {
				elapsedTimeSeconds = clampNumber(timeSeconds - this.lastCanvasRenderTimeSeconds, 1 / 240, 0.25);
			}
			this.lastCanvasRenderTimeSeconds = timeSeconds;
			this.visualizer.render({elapsedTime: elapsedTimeSeconds});
			this.canvasRenderVersion += 1;
		},
		getPresetNames: function() {
			return this.presetNames.slice();
		},
		getCurrentPresetIndex: function() {
			return this.currentPresetIndex;
		},
		getAudioMetrics: function() {
			return audioAnalyser.getMetrics();
		},
		getState: function() {
			const presetName = this.presetNames[this.currentPresetIndex] || "";
			return {
				presetName: presetName,
				presetVersion: this.presetVersion,
				audioVersion: this.audioVersion,
				canvasRenderVersion: this.canvasRenderVersion,
				canvas: this.canvas,
				textureSource: this.canvas,
				audioMetrics: audioAnalyser.getMetrics(),
				timeSeconds: this.currentTimeSeconds
			};
		},
		startSession: function() {
			this.activate();
		},
		endSession: function() {
		}
	});
	return source;
};
