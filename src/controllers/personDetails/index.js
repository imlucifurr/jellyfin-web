import itemDetailsPage from '../itemDetails/index';
import loading from 'components/loading/loading';

import 'styles/persondetails.scss';

export default function (view, params) {
    view.classList.add('personDetailPage');
    view.addEventListener('viewshow', function onPersonViewShow() {
        loading.hide();
    });
    return itemDetailsPage.call(this, view, params);
}
