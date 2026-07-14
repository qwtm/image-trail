import { destinationFromLocation, destinationPageUrl, sourceTabIdFromSearch } from '../core/destinations.js';
import { renderReactSubtree } from '../ui/react/react-subtree.js';
import { DashboardDestination } from './dashboard-destination.js';
import { DestinationFrame } from './destination-frame.js';
import { RecallDestination } from './recall-destination.js';
import { createDestinationServices } from './destination-services.js';
import { SettingsDestination } from './settings-destination.js';

const destination = destinationFromLocation(window.location);
const sourceTabId = sourceTabIdFromSearch(window.location.search);

if (destination === 'gallery') {
  const target = destinationPageUrl('gallery', chrome.runtime.getURL, sourceTabId);
  window.location.replace(target);
} else {
  const root = document.getElementById('image-trail-destination-root');
  if (!root) throw new Error('Destination page root is missing.');
  const services = createDestinationServices();
  const body =
    destination === 'dashboard' ? (
      <DashboardDestination services={services} />
    ) : destination === 'recall' ? (
      <RecallDestination services={services} />
    ) : (
      <SettingsDestination services={services} />
    );
  renderReactSubtree(root, <DestinationFrame destination={destination}>{body}</DestinationFrame>);
}
