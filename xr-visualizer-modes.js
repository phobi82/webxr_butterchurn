// Extend this file with more mode functions and register them below.

const headYawBufferShiftFactor = 0.8;
const headPitchBufferShiftFactor = 0.8;

const toroidalFragmentSource = [
	"precision highp float;",
	"uniform sampler2D sourceTexture;",
	"uniform vec2 viewportSize;",
	"uniform vec2 eyeCenterOffset;",
	"uniform vec2 orientationOffset;",
	"uniform float backgroundAlpha;",
	"varying vec2 vScreenUv;",
	"float mirrorRepeat(float value){",
	"float wrapped=value-floor(value*0.5)*2.0;",
	"return wrapped<=1.0?wrapped:2.0-wrapped;",
	"}",
	"void main(){",
	"vec2 texel=(floor((vScreenUv-eyeCenterOffset)*viewportSize)+vec2(0.5))/viewportSize;",
	"vec2 sampleUv=vec2(fract(texel.x+orientationOffset.x),mirrorRepeat(texel.y+orientationOffset.y));",
	"vec4 sampleColor=texture2D(sourceTexture,sampleUv);",
	"gl_FragColor=vec4(sampleColor.rgb,sampleColor.a*backgroundAlpha);",
	"}"
].join("");

const toroidal = function() {
	return createFullscreenTextureMode({
		label: "Toroidal mode",
		fragmentSource: toroidalFragmentSource,
		getOrientationOffset: function(sourceState, frameState) {
			return {
				x: wrapUnit(frameState.headYaw * headYawBufferShiftFactor / frameState.headHorizontalFov),
				y: clampNumber(frameState.headPitch * headPitchBufferShiftFactor / frameState.headVerticalFov, -1000, 1000)
			};
		}
	});
};

const skysphereFragmentSource = [
	"precision highp float;",
	"uniform sampler2D sourceTexture;",
	"uniform vec3 camRight;",
	"uniform vec3 camUp;",
	"uniform vec3 camForward;",
	"uniform vec4 projParams;",
	"uniform vec2 texScale;",
	"uniform float backgroundAlpha;",
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
	"vec2 uv=vec2(fract(yaw*texScale.x+0.5),mirrorRepeat(pitch*texScale.y+0.5));",
	"vec4 sampleColor=texture2D(sourceTexture,uv);",
	"gl_FragColor=vec4(sampleColor.rgb,sampleColor.a*backgroundAlpha);",
	"}"
].join("");

const skysphere = function() {
	let camRightLoc = null;
	let camUpLoc = null;
	let camForwardLoc = null;
	let projParamsLoc = null;
	let texScaleLoc = null;
	let base = createFullscreenTextureMode({
		label: "Skysphere mode",
		fragmentSource: skysphereFragmentSource,
		applyUniforms: function(gl, programInfo, sourceState, frameState) {
			let vm = frameState.viewMatrix;
			let pm = frameState.projMatrix;
			gl.uniform3f(camRightLoc, vm[0], vm[4], vm[8]);
			gl.uniform3f(camUpLoc, vm[1], vm[5], vm[9]);
			gl.uniform3f(camForwardLoc, -vm[2], -vm[6], -vm[10]);
			gl.uniform4f(projParamsLoc, pm[0], pm[5], pm[8], pm[9]);
			gl.uniform2f(texScaleLoc, 1.0 / frameState.headHorizontalFov, 1.0 / frameState.headVerticalFov);
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
	"uniform float backgroundAlpha;",
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
	"vec2 uv=vec2(fract(totalYaw*texScale.x+0.5),mirrorRepeat(totalPitch*texScale.y+0.5));",
	"vec4 sampleColor=texture2D(sourceTexture,uv);",
	"gl_FragColor=vec4(sampleColor.rgb,sampleColor.a*backgroundAlpha);",
	"}"
].join("");

const skyToroid = function() {
	let projParamsLoc = null;
	let headOrientationLoc = null;
	let headRollLoc = null;
	let texScaleLoc = null;
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
