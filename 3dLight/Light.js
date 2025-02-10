const bulb = document.getElementById('bulb');
const switchDiv = document.getElementById('switch');
const switchIcon = switchDiv.querySelector('i');

switchDiv.addEventListener('click', () => {
  if (switchIcon.classList.contains('bxs-toggle-left')) {
    switchIcon.classList.replace('bxs-toggle-left', 'bxs-toggle-right');
    switchDiv.classList.replace('switch-off', 'switch-on');
    bulb.classList.replace('bulb-off', 'bulb-on');
  } else {
    switchIcon.classList.replace('bxs-toggle-right', 'bxs-toggle-left');
    switchDiv.classList.replace('switch-on', 'switch-off');
    bulb.classList.replace('bulb-on', 'bulb-off');
  }
});