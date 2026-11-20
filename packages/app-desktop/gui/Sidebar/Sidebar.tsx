import * as React from 'react';
import { useEffect, useState } from 'react';
import { StyledSyncReportText, StyledSyncReport, StyledSynchronizeButton, StyledRoot } from './styles';
import { ButtonLevel, ButtonSize } from '../Button/Button';
import CommandService from '@joplin/lib/services/CommandService';
import Synchronizer, { type ProgressReport } from '@joplin/lib/Synchronizer';
import Setting from '@joplin/lib/models/Setting';
import { _ } from '@joplin/lib/locale';
import { AppState } from '../../app.reducer';
import { StateDecryptionWorker, StateResourceFetcher } from '@joplin/lib/reducer';
import { connect } from 'react-redux';
import { themeStyle } from '@joplin/lib/theme';
import { Dispatch } from 'redux';
import FolderAndTagList from './FolderAndTagList';


interface Props {
	themeId: number;
	dispatch: Dispatch;
	decryptionWorker: StateDecryptionWorker;
	resourceFetcher: StateResourceFetcher;
	syncReport: ProgressReport;
	syncStarted: boolean;
	syncPending: boolean;
	syncReportIsVisible: boolean;
	width?: number;
}

const SidebarComponent = (props: Props) => {
	const [rootElement, setRootElement] = useState<HTMLDivElement|null>(null);
	const [measuredWidth, setMeasuredWidth] = useState(0);

	useEffect(() => {
		if (!rootElement) return () => {};
		setMeasuredWidth(rootElement.clientWidth);
		if (typeof ResizeObserver === 'undefined') return () => {};
		const observer = new ResizeObserver(() => {
			setMeasuredWidth(rootElement.clientWidth);
		});
		observer.observe(rootElement);
		return () => {
			observer.disconnect();
		};
	}, [rootElement]);

	const effectiveWidth = measuredWidth || props.width || 0;
	const isCompact = effectiveWidth > 0 && effectiveWidth <= 84;

	const renderSynchronizeButton = (isSyncing: boolean) => {
		const label = isSyncing ? _('Cancel') : _('Synchronise');
		const syncHasErrors = !isSyncing && !props.syncPending && !!props.syncReport.errors?.length;
		const iconName = syncHasErrors ? 'fas fa-exclamation-triangle' : 'icon-sync';

		return (
			<StyledSynchronizeButton
				level={ButtonLevel.SidebarSecondary}
				size={isCompact ? ButtonSize.Small : ButtonSize.Normal}
				isSquare={true}
				className={`sidebar-sync-button ${syncHasErrors ? '-error' : ''} ${isCompact ? '-compact' : ''}`}
				iconName={iconName}
				iconLabel={syncHasErrors ? _('Synchronisation error') : undefined}
				aria-busy={isSyncing}
				key="sync_button"
				tooltip={label}
				onClick={() => {
					void CommandService.instance().execute('synchronize', isSyncing);
				}}
			/>
		);
	};

	const theme = themeStyle(props.themeId);

	let decryptionReportText = '';
	if (props.decryptionWorker && props.decryptionWorker.state !== 'idle' && props.decryptionWorker.itemCount) {
		decryptionReportText = _('Decrypting items: %d/%d', props.decryptionWorker.itemIndex + 1, props.decryptionWorker.itemCount);
	}

	let resourceFetcherText = '';
	if (props.resourceFetcher && props.resourceFetcher.toFetchCount) {
		resourceFetcherText = _('Fetching resources: %d/%d', props.resourceFetcher.fetchingCount, props.resourceFetcher.toFetchCount);
	}

	const lines = Synchronizer.reportToLines(props.syncReport);
	if (resourceFetcherText) lines.push(resourceFetcherText);
	if (decryptionReportText) lines.push(decryptionReportText);
	const syncReportText = [];
	for (let i = 0; i < lines.length; i++) {
		syncReportText.push(
			<StyledSyncReportText key={i}>
				{lines[i]}
			</StyledSyncReportText>,
		);
	}

	const syncButton = renderSynchronizeButton(props.syncStarted);

	const hasSyncReport = syncReportText.length > 0;

	const syncReportComp = !hasSyncReport || !props.syncReportIsVisible ? null : (
		<StyledSyncReport key="sync_report" id="sync-report">
			{syncReportText}
		</StyledSyncReport>
	);

	const syncReportToggle = (
		<button
			className="sync-report-toggle"
			style={{ color: theme.color2 }}
			onClick={() => Setting.toggle('syncReportIsVisible')}
			aria-label={_('Sync report')}
			aria-expanded={props.syncReportIsVisible}
			aria-controls="sync-report"
		>
			<i className={`fas fa-chevron-${props.syncReportIsVisible ? 'down' : 'up'}`}/>
		</button>
	);

	return (
		<StyledRoot ref={setRootElement} className={`sidebar _scrollbar2${isCompact ? ' -compact' : ''}`} role='navigation' aria-label={_('Sidebar')}>
			<div className='sidebar-titlebar-drag'/>
			<div style={{ flex: 1, minHeight: 0, paddingTop: 4 }}><FolderAndTagList isCompact={isCompact}/></div>
			<div style={isCompact ? { flex: 0, padding: '8px 0 10px', borderTop: '1px solid var(--joplin-divider-color)', display: 'flex', justifyContent: 'center' } : { flex: 0, padding: '8px 10px 10px', borderTop: '1px solid var(--joplin-divider-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				{isCompact ? null : syncReportToggle}
				{isCompact ? null : syncReportComp}
				{syncButton}
			</div>
		</StyledRoot>
	);
};

const mapStateToProps = (state: AppState) => {
	return {
		searches: state.searches,
		syncStarted: state.syncStarted,
		syncPending: state.syncPending,
		syncReport: state.syncReport,
		selectedSearchId: state.selectedSearchId,
		selectedSmartFilterId: state.selectedSmartFilterId,
		locale: state.settings.locale,
		themeId: state.settings.theme,
		collapsedFolderIds: state.collapsedFolderIds,
		decryptionWorker: state.decryptionWorker,
		resourceFetcher: state.resourceFetcher,
		syncReportIsVisible: state.settings.syncReportIsVisible,
	};
};

export default connect(mapStateToProps)(SidebarComponent);
