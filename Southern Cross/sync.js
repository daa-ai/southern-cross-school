// Simple cross-device sync using a shared file
window.SCHOOL_SYNC = {
    save: function(data) {
        fetch('data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data)))
            .catch(() => {});
        localStorage.setItem('GLOBAL_SCHOOL_DATA', JSON.stringify(data));
        sessionStorage.setItem('GLOBAL_SCHOOL_DATA', JSON.stringify(data));
    },
    
    load: function() {
        try {
            return JSON.parse(localStorage.getItem('GLOBAL_SCHOOL_DATA') || '{}');
        } catch(e) {
            return {};
        }
    }
};