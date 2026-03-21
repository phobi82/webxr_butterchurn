// TestLab uses a reduced menu so effect review stays focused.

const createTestLabAudioBarItems = function(audioMetrics) {
	audioMetrics = audioMetrics || emptyAudioMetrics;
	return [
		{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
		{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
		{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
		{label: "Beat Pulse", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)},
		{label: "Strobe", value: clampNumber(audioMetrics.strobeGate || 0, 0, 1)},
		{label: "Left Hit", value: clampNumber(audioMetrics.leftImpact || 0, 0, 1)},
		{label: "Right Hit", value: clampNumber(audioMetrics.rightImpact || 0, 0, 1)}
	];
};

const createTestLabMenuSections = function(args) {
	args = args || {};
	const controls = [
		createCyclerMenuControlState({
			key: "sceneLightPreset",
			label: "Active Effect",
			valueText: args.currentLightPresetName || "Soft Wash",
			metaText: args.currentLightPresetDescription || "",
			hoveredAction: args.hoveredLightPresetAction || ""
		})
	];
	if (args.sceneLightingPrimaryControl) {
		controls.push(createSliderMenuControlState({
			key: args.sceneLightingPrimaryControl.key,
			label: args.sceneLightingPrimaryControl.label,
			valueText: formatMenuPercentText(args.sceneLightingPrimaryControl.value),
			sliderU: args.sceneLightingPrimarySliderU || 0,
			minLabel: args.sceneLightingPrimaryControl.minLabel,
			maxLabel: args.sceneLightingPrimaryControl.maxLabel,
			hoveredBool: !!args.sceneLightingPrimaryHoverBool,
			activeBool: !!args.sceneLightingPrimaryActiveBool
		}));
	}
	return [
		createMenuSectionState({
			key: "testLabEffect",
			title: "Effect Review",
			badgeText: (args.currentLightPresetIndex + 1) + " / " + ((args.lightPresetNames && args.lightPresetNames.length) || 1),
			controls: controls
		}),
		createMenuSectionState({
			key: "testLabIsolation",
			title: "Isolation",
			statusText: "Uniform / Manual / Mix 100% is the default lab baseline",
			controls: []
		}),
		createSessionMenuSectionState({
			xrSessionActiveBool: !!args.xrSessionActiveBool,
			hoveredExitVrBool: !!args.hoveredExitVrBool
		})
	].filter(Boolean);
};
