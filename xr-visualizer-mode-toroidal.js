(function() {
	// Simple fullscreen mode that remaps the Butterchurn canvas with head-driven toroidal offsets.
	const utils = window.xrVisualizerUtils;
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

	window.registerXrVisualizerMode("toroidal", function() {
		return window.createXrVisualizerFullscreenTextureMode({
			label: "Toroidal mode",
			fragmentSource: toroidalFragmentSource,
			getOrientationOffset: function(sourceState, frameState) {
				return {
					x: utils.wrapUnit(frameState.headYaw * headYawBufferShiftFactor / frameState.headHorizontalFov),
					y: utils.clampNumber(frameState.headPitch * headPitchBufferShiftFactor / frameState.headVerticalFov, -1000, 1000)
				};
			}
		});
	});
})();
