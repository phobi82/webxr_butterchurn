// Extend this file with more mode functions and register them below.

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
