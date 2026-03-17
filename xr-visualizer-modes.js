// Extend this file with more mode functions and register them below.

const headYawBufferShiftFactor = 0.8;
const headPitchBufferShiftFactor = 0.8;

const toroidalFragmentSource = [
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

const stereoVolume = function() {
	return {
		resetGeometry: function() {},
		init: function() {},
		update: function() {},
		drawPreScene: function() {},
		drawWorld: function() {},
		drawPostScene: function() {},
		onPresetChanged: function() {},
		onAudioChanged: function() {},
		onSessionStart: function() {},
		onSessionEnd: function() {}
	};
};

const visualizerModeDefinitions = [
	{
		name: formatFunctionLabel(toroidal.name),
		create: toroidal
	},
	{
		name: formatFunctionLabel(stereoVolume.name),
		create: stereoVolume
	}
];
