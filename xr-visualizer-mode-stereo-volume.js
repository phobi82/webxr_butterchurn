(function() {
	const utils = window.xrVisualizerUtils;
	const headYawBufferShiftFactor = 0.8;
	const headPitchBufferShiftFactor = 0.8;
	const stereoVolumeFragmentSource = [
		"precision highp float;",
		"uniform sampler2D sourceTexture;",
		"uniform vec2 viewportSize;",
		"uniform vec2 eyeCenterOffset;",
		"uniform vec2 orientationOffset;",
		"uniform vec4 audioMetrics;",
		"uniform float beatPulse;",
		"varying vec2 vScreenUv;",
		"float mirrorRepeat(float value){",
		"float wrapped=value-floor(value*0.5)*2.0;",
		"return wrapped<=1.0?wrapped:2.0-wrapped;",
		"}",
		"vec2 wrapUv(vec2 uv){",
		"return vec2(fract(uv.x),mirrorRepeat(uv.y));",
		"}",
		"vec3 sampleWrapped(vec2 uv){",
		"return texture2D(sourceTexture,wrapUv(uv)).rgb;",
		"}",
		"void main(){",
		"vec2 texel=1.0/max(viewportSize,vec2(1.0));",
		"vec2 centered=vScreenUv-0.5-eyeCenterOffset;",
		"float radius=length(centered);",
		"float stereoStrength=eyeCenterOffset.x*(14.0+audioMetrics.z*10.0);",
		"vec2 headFlow=orientationOffset;",
		"vec3 accum=vec3(0.0);",
		"float trans=1.0;",
		"for(int i=0;i<6;i+=1){",
		"float layerT=float(i)/5.0;",
		"float depthZ=layerT*2.0-1.0;",
		"float shell=1.0-abs(depthZ);",
		"vec2 swirl=vec2(-centered.y,centered.x)*depthZ*(0.12+beatPulse*0.04+radius*0.25);",
		"vec2 sampleUv=centered*(1.0-depthZ*0.12)+vec2(0.5)+vec2(stereoStrength*depthZ*(0.012+shell*0.006),0.0)+headFlow*depthZ*(0.22+audioMetrics.x*0.12)+swirl*(0.05+audioMetrics.z*0.03);",
		"vec3 color=sampleWrapped(sampleUv);",
		"vec3 neighborX=sampleWrapped(sampleUv+vec2(texel.x*1.5,0.0));",
		"vec3 neighborY=sampleWrapped(sampleUv+vec2(0.0,texel.y*1.5));",
		"float luma=dot(color,vec3(0.299,0.587,0.114));",
		"float saturation=max(color.r,max(color.g,color.b))-min(color.r,min(color.g,color.b));",
		"float edge=length(color-neighborX)+length(color-neighborY);",
		"float centerBias=1.0-clamp(radius*2.0+abs(depthZ)*0.18,0.0,1.0);",
		"float density=clamp(luma*0.48+saturation*0.36+edge*1.25+centerBias*0.18+audioMetrics.w*0.22+beatPulse*0.08,0.0,1.0);",
		"float alpha=clamp((0.06+shell*0.12+audioMetrics.z*0.05)*density,0.0,0.65);",
		"accum+=color*alpha*trans;",
		"trans*=1.0-alpha*0.82;",
		"}",
		"vec2 backgroundUv=centered*(1.0+audioMetrics.x*0.04)+vec2(0.5)+headFlow*0.08;",
		"vec3 backgroundColor=sampleWrapped(backgroundUv);",
		"vec3 glowColor=sampleWrapped(vec2(0.5)+centered*0.82-headFlow*0.04);",
		"vec3 color=accum+backgroundColor*(0.32+trans*0.58)+glowColor*(0.08+beatPulse*0.06);",
		"color*=1.0+audioMetrics.y*0.08;",
		"gl_FragColor=vec4(color,1.0);",
		"}"
	].join("");

	window.registerXrVisualizerMode("stereoVolume", function() {
		return window.createXrVisualizerFullscreenTextureMode({
			label: "Stereo volume mode",
			fragmentSource: stereoVolumeFragmentSource,
			includeAudioUniformsBool: true,
			getOrientationOffset: function(sourceState, frameState) {
				return {
					x: Math.sin(frameState.headYaw) * headYawBufferShiftFactor * 0.12,
					y: utils.clampNumber(frameState.headPitch * headPitchBufferShiftFactor / frameState.headVerticalFov, -1, 1) * 0.12
				};
			}
		});
	});
})();
