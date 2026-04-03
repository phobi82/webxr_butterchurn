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
		baseInit(options);
		horizontalMirrorLoc = base.gl.getUniformLocation(base.programInfo.program, "horizontalMirror");
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
		baseInit(options);
		let program = base.programInfo.program;
		camRightLoc = base.gl.getUniformLocation(program, "camRight");
		camUpLoc = base.gl.getUniformLocation(program, "camUp");
		camForwardLoc = base.gl.getUniformLocation(program, "camForward");
		projParamsLoc = base.gl.getUniformLocation(program, "projParams");
		texScaleLoc = base.gl.getUniformLocation(program, "texScale");
		horizontalMirrorLoc = base.gl.getUniformLocation(program, "horizontalMirror");
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
		baseInit(options);
		let program = base.programInfo.program;
		projParamsLoc = base.gl.getUniformLocation(program, "projParams");
		headOrientationLoc = base.gl.getUniformLocation(program, "headOrientation");
		headRollLoc = base.gl.getUniformLocation(program, "headRoll");
		texScaleLoc = base.gl.getUniformLocation(program, "texScale");
		horizontalMirrorLoc = base.gl.getUniformLocation(program, "horizontalMirror");
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
	const mode = {
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
		update: function() {}
	};
	const init = function(options) {
		mode.gl = options.gl;
		mode.sourceBackend = options.sourceBackend;
		mode.programInfo = createFullscreenProgramInfo(mode.gl, spec.fragmentSource, !!spec.includeAudioUniformsBool, spec.label || "Visualizer mode");
		mode.positionBuffer = createFullscreenTriangleBuffer(mode.gl);
		mode.sourceTexture = mode.gl.createTexture();
		mode.gl.bindTexture(mode.gl.TEXTURE_2D, mode.sourceTexture);
		mode.gl.texParameteri(mode.gl.TEXTURE_2D, mode.gl.TEXTURE_MIN_FILTER, mode.gl.LINEAR);
		mode.gl.texParameteri(mode.gl.TEXTURE_2D, mode.gl.TEXTURE_MAG_FILTER, mode.gl.LINEAR);
		mode.gl.texParameteri(mode.gl.TEXTURE_2D, mode.gl.TEXTURE_WRAP_S, mode.gl.CLAMP_TO_EDGE);
		mode.gl.texParameteri(mode.gl.TEXTURE_2D, mode.gl.TEXTURE_WRAP_T, mode.gl.CLAMP_TO_EDGE);
	};
	const uploadSourceTexture = function(sourceCanvas) {
		mode.gl.bindTexture(mode.gl.TEXTURE_2D, mode.sourceTexture);
		mode.gl.pixelStorei(mode.gl.UNPACK_FLIP_Y_WEBGL, true);
		mode.gl.texImage2D(mode.gl.TEXTURE_2D, 0, mode.gl.RGBA, mode.gl.RGBA, mode.gl.UNSIGNED_BYTE, sourceCanvas);
		mode.gl.pixelStorei(mode.gl.UNPACK_FLIP_Y_WEBGL, false);
	};
	const resetPreparedSourceFrame = function() {
		mode.lastUploadedCanvasVersion = -1;
		mode.lastPreparedTimeSeconds = -1;
	};
	const prepareSourceFrame = function(sourceWidth, sourceHeight, timeSeconds) {
		mode.sourceBackend.ensureCanvasSize(sourceWidth, sourceHeight);
		mode.sourceBackend.advanceFrame(timeSeconds);
		if (mode.lastPreparedTimeSeconds === timeSeconds && sourceWidth === mode.lastPreparedWidth && sourceHeight === mode.lastPreparedHeight) {
			return mode.sourceBackend.state;
		}
		mode.sourceBackend.renderCanvas(timeSeconds);
		mode.lastPreparedTimeSeconds = timeSeconds;
		mode.lastPreparedWidth = sourceWidth;
		mode.lastPreparedHeight = sourceHeight;
		return mode.sourceBackend.state;
	};
	const drawPreScene = function(sourceState, frameState) {
			const viewport = mode.gl.getParameter(mode.gl.VIEWPORT);
			const width = viewport[2];
			const height = viewport[3];
			const sourceSize = spec.getSourceFrameSize ? spec.getSourceFrameSize(frameState, width, height) : null;
			const sourceWidth = Math.max(1, sourceSize && sourceSize.width ? sourceSize.width | 0 : width | 0);
			const sourceHeight = Math.max(1, sourceSize && sourceSize.height ? sourceSize.height | 0 : height | 0);
			sourceState = prepareSourceFrame(sourceWidth, sourceHeight, frameState.timeSeconds);
			const sourceCanvas = sourceState.textureSource;
			if (!sourceCanvas) {
				return;
			}
			if (sourceState.canvasRenderVersion !== mode.lastUploadedCanvasVersion || sourceWidth !== mode.lastUploadedWidth || sourceHeight !== mode.lastUploadedHeight) {
				uploadSourceTexture(sourceCanvas);
				mode.lastUploadedCanvasVersion = sourceState.canvasRenderVersion;
				mode.lastUploadedWidth = sourceWidth;
				mode.lastUploadedHeight = sourceHeight;
			}
			const orientationOffset = spec.getOrientationOffset ? spec.getOrientationOffset(sourceState, frameState) : {x: 0, y: 0};
			mode.gl.disable(mode.gl.DEPTH_TEST);
			mode.gl.disable(mode.gl.CULL_FACE);
			mode.gl.useProgram(mode.programInfo.program);
			mode.gl.bindBuffer(mode.gl.ARRAY_BUFFER, mode.positionBuffer);
			mode.gl.enableVertexAttribArray(mode.programInfo.positionLoc);
			mode.gl.vertexAttribPointer(mode.programInfo.positionLoc, 2, mode.gl.FLOAT, false, 0, 0);
			mode.gl.activeTexture(mode.gl.TEXTURE0);
			mode.gl.bindTexture(mode.gl.TEXTURE_2D, mode.sourceTexture);
			mode.gl.uniform1i(mode.programInfo.sourceTextureLoc, 0);
			mode.gl.uniform2f(mode.programInfo.viewportSizeLoc, width, height);
			mode.gl.uniform2f(mode.programInfo.eyeCenterOffsetLoc, frameState.eyeCenterOffsetX, frameState.eyeCenterOffsetY);
			mode.gl.uniform2f(mode.programInfo.orientationOffsetLoc, orientationOffset.x, orientationOffset.y);
			if (mode.programInfo.backgroundAlphaLoc) {
				mode.gl.uniform1f(mode.programInfo.backgroundAlphaLoc, frameState.backgroundAlpha);
			}
			if (mode.programInfo.backgroundMaskCountLoc) {
				mode.gl.uniform1f(mode.programInfo.backgroundMaskCountLoc, frameState.backgroundMaskCount);
			}
			if (mode.programInfo.backgroundMaskCentersLoc) {
				mode.gl.uniform2fv(mode.programInfo.backgroundMaskCentersLoc, frameState.backgroundMaskCenters);
			}
			if (mode.programInfo.backgroundMaskParamsLoc) {
				mode.gl.uniform2fv(mode.programInfo.backgroundMaskParamsLoc, frameState.backgroundMaskParams);
			}
			if (mode.programInfo.audioMetricsLoc) {
				const audioMetrics = sourceState.audioMetrics || {level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0};
				mode.gl.uniform4f(mode.programInfo.audioMetricsLoc, audioMetrics.level, audioMetrics.peak, audioMetrics.bass, audioMetrics.transient);
			}
			if (mode.programInfo.beatPulseLoc) {
				mode.gl.uniform1f(mode.programInfo.beatPulseLoc, sourceState.audioMetrics ? sourceState.audioMetrics.beatPulse : 0);
			}
			if (spec.applyUniforms) {
				spec.applyUniforms(mode.gl, mode.programInfo, sourceState, frameState);
			}
			mode.gl.drawArrays(mode.gl.TRIANGLES, 0, 3);
			mode.gl.enable(mode.gl.DEPTH_TEST);
			mode.gl.enable(mode.gl.CULL_FACE);
	};
	mode.init = init;
	mode.uploadSourceTexture = uploadSourceTexture;
	mode.onPresetChanged = resetPreparedSourceFrame;
	mode.onAudioChanged = resetPreparedSourceFrame;
	mode.prepareSourceFrame = prepareSourceFrame;
	mode.drawPreScene = drawPreScene;
	return mode;
};

// Engine
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

const createVisualizerEngine = function(options) {
	const modeDefinitions = options.modes || [];
	const frameState = {
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
	const state = {
		gl: null,
		sourceBackend: null,
		modeNames: [],
		modes: {},
		currentModeIndex: 0,
		horizontalMirrorBool: true
	};
	const notifyModes = function(methodName) {
		const sourceState = state.sourceBackend ? state.sourceBackend.state : null;
		for (let i = 0; i < state.modeNames.length; i += 1) {
			const mode = state.modes[state.modeNames[i]];
			if (mode && mode[methodName]) {
				mode[methodName](sourceState, frameState);
			}
		}
	};
	const drawActiveMode = function(methodName) {
		const mode = state.modes[state.modeNames[state.currentModeIndex]] || null;
		if (!mode || !mode[methodName]) {
			return;
		}
		mode[methodName](state.sourceBackend ? state.sourceBackend.state : null, frameState);
	};
	const engine = {
		state
	};
	const init = function(args) {
		const modeRegistry = createVisualizerModeRegistry(modeDefinitions, args.gl, args.sourceBackend);
		state.gl = args.gl;
		state.sourceBackend = args.sourceBackend;
		engine.activateAudio = state.sourceBackend.activate;
		state.sourceBackend.init(args.gl.drawingBufferWidth || 512, args.gl.drawingBufferHeight || 512);
		state.modeNames = modeRegistry.modeNames;
		state.modes = modeRegistry.modes;
		if (state.currentModeIndex >= state.modeNames.length) {
			state.currentModeIndex = 0;
		}
		frameState.horizontalMirrorBool = state.horizontalMirrorBool;
	};
	const update = function(timeSeconds) {
		frameState.timeSeconds = timeSeconds;
		state.sourceBackend.advanceFrame(timeSeconds);
		const activeMode = state.modes[state.modeNames[state.currentModeIndex]] || null;
		if (activeMode && activeMode.update) {
			activeMode.update(state.sourceBackend.state, frameState);
		}
	};
	const setBackgroundCompositeState = function(backgroundCompositeState) {
		setVisualizerBackgroundCompositeState(frameState, backgroundCompositeState);
	};
	const selectPreset = async function(index) {
		await state.sourceBackend.selectPreset(index, 1.2);
		state.sourceBackend.state.lastCanvasRenderTimeSeconds = 0;
		notifyModes("onPresetChanged");
	};
	const selectMode = function(index) {
		if (!state.modeNames.length) {
			return resolvedVisualizerActionPromise;
		}
		state.currentModeIndex = (index + state.modeNames.length) % state.modeNames.length;
		return resolvedVisualizerActionPromise;
	};
	const toggleHorizontalMirror = function() {
		state.horizontalMirrorBool = !state.horizontalMirrorBool;
		frameState.horizontalMirrorBool = state.horizontalMirrorBool;
		return resolvedVisualizerActionPromise;
	};
	const startSession = function() {
		state.sourceBackend.activate();
		notifyModes("onSessionStart");
	};
	const endSession = function() {
		notifyModes("onSessionEnd");
	};
	engine.init = init;
	engine.update = update;
	engine.setRenderView = function(viewMatrix, projectionMatrix) {
		applyVisualizerRenderView(frameState, viewMatrix, projectionMatrix);
	};
	engine.setPreviewView = function(viewMatrix, projectionMatrix) {
		applyVisualizerPreviewView(frameState, viewMatrix, projectionMatrix);
	};
	engine.setHeadPoseFromQuaternion = function(quaternion, projectionMatrix) {
		applyVisualizerHeadPose(frameState, quaternion, projectionMatrix);
	};
	engine.setHeadPosition = function(x, y, z) {
		frameState.headPositionX = x;
		frameState.headPositionY = y;
		frameState.headPositionZ = z;
	};
	engine.setBackgroundCompositeState = setBackgroundCompositeState;
	engine.setBackgroundBlend = function(passthroughMix, passthroughAvailableBool) {
		setBackgroundCompositeState({
			alpha: passthroughAvailableBool ? clampNumber(1 - (passthroughMix || 0), 0, 1) : 1,
			maskCount: 0,
			masks: []
		});
	};
	engine.drawPreScene = function() {
		drawActiveMode("drawPreScene");
	};
	engine.drawWorld = function() {
		drawActiveMode("drawWorld");
	};
	engine.drawPostScene = function() {
		drawActiveMode("drawPostScene");
	};
	engine.setAudioStream = function(stream) {
		state.sourceBackend.setAudioStream(stream);
		notifyModes("onAudioChanged");
	};
	engine.startDebugAudio = async function() {
		await state.sourceBackend.startDebugAudio();
		notifyModes("onAudioChanged");
	};
	engine.selectPreset = selectPreset;
	engine.selectMode = selectMode;
	engine.toggleHorizontalMirror = toggleHorizontalMirror;
	engine.startSession = startSession;
	engine.endSession = endSession;
	return engine;
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

const initButterchurnPresetLibrary = function(source, butterchurnPresetsApi) {
	source.presetMap = butterchurnPresetsApi ? butterchurnPresetsApi.getPresets() : {};
	source.presetNames = Object.keys(source.presetMap).sort();
	source.currentPresetIndex = Math.max(0, source.presetNames.indexOf(defaultPresetName));
	source.presetName = source.presetNames[source.currentPresetIndex] || "";
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
	const state = {
		canvas: null,
		textureSource: null,
		visualizer: null,
		audioContext: null,
		audioNode: null,
		audioStream: null,
		audioSourceKind: "none",
		audioMetrics: emptyAudioMetrics,
		activatedBool: false,
		presetNames: [],
		presetMap: {},
		presetName: "",
		currentPresetIndex: 0,
		currentWidth: 0,
		currentHeight: 0,
		timeSeconds: 0,
		currentTimeSeconds: 0,
		lastCanvasRenderTimeSeconds: 0,
		presetVersion: 0,
		audioVersion: 0,
		canvasRenderVersion: 0
	};
	const source = {
		state
	};
	source.init = function(width, height) {
		state.canvas = createButterchurnCanvasElement(documentRef, width, height);
		state.textureSource = state.canvas;
		state.currentWidth = width;
		state.currentHeight = height;
		initButterchurnPresetLibrary(state, butterchurnPresetsApi);
	};
	source.advanceFrame = function(timeSeconds) {
		state.currentTimeSeconds = typeof timeSeconds === "number" ? timeSeconds : 0;
		state.timeSeconds = state.currentTimeSeconds;
		audioAnalyser.advanceFrame(state.currentTimeSeconds);
		state.audioMetrics = audioAnalyser.getMetrics();
	};
	source.activate = async function() {
		await activateButterchurnBackend(state, audioContextCtor, butterchurnApi);
		if (!state.visualizer) {
			return resolvedButterchurnReadyPromise;
		}
		await source.selectPreset(state.currentPresetIndex, 0);
		await syncButterchurnAudioInput(state, audioAnalyser);
		if (state.audioContext && state.audioContext.state === "suspended") {
			return state.audioContext.resume().catch(function() {});
		}
		return resolvedButterchurnReadyPromise;
	};
	source.ensureCanvasSize = function(width, height) {
		width = Math.max(1, width | 0);
		height = Math.max(1, height | 0);
		if (!state.canvas || width === state.currentWidth && height === state.currentHeight) {
			return;
		}
		state.currentWidth = width;
		state.currentHeight = height;
		state.canvas.width = width;
		state.canvas.height = height;
		if (state.visualizer) {
			state.visualizer.setRendererSize(width, height, {meshWidth: 32, meshHeight: 24, pixelRatio: 1, textureRatio: 1});
		}
	};
	source.setAudioStream = function(stream) {
		if (state.audioSourceKind !== "stream" || state.audioStream !== stream) {
			state.audioVersion += 1;
		}
		state.audioStream = stream;
		state.audioSourceKind = stream ? "stream" : "none";
		syncButterchurnAudioInput(state, audioAnalyser);
	};
	source.startDebugAudio = function() {
		if (state.audioSourceKind !== "debug") {
			state.audioVersion += 1;
		}
		state.audioStream = null;
		state.audioSourceKind = "debug";
		return syncButterchurnAudioInput(state, audioAnalyser);
	};
	source.selectPreset = function(index, blendTimeSeconds) {
		if (!state.presetNames.length) {
			return resolvedButterchurnReadyPromise;
		}
		const nextPresetIndex = (index + state.presetNames.length) % state.presetNames.length;
		if (nextPresetIndex !== state.currentPresetIndex) {
			state.currentPresetIndex = nextPresetIndex;
			state.presetName = state.presetNames[state.currentPresetIndex] || "";
			state.presetVersion += 1;
		}
		if (!state.visualizer) {
			return resolvedButterchurnReadyPromise;
		}
		state.visualizer.loadPreset(state.presetMap[state.presetNames[state.currentPresetIndex]], blendTimeSeconds || 0);
		return resolvedButterchurnReadyPromise;
	};
	source.renderCanvas = function(timeSeconds) {
		source.advanceFrame(timeSeconds);
		if (!state.visualizer) {
			return;
		}
		let elapsedTimeSeconds = 1 / 60;
		if (state.lastCanvasRenderTimeSeconds > 0) {
			elapsedTimeSeconds = clampNumber(timeSeconds - state.lastCanvasRenderTimeSeconds, 1 / 240, 0.25);
		}
		state.lastCanvasRenderTimeSeconds = timeSeconds;
		state.visualizer.render({elapsedTime: elapsedTimeSeconds});
		state.canvasRenderVersion += 1;
	};
	return source;
};
