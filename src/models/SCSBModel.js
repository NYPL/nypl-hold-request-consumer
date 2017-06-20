/* eslint-disable semi */
function SCSBModel(obj) {
  if (!(this instanceof SCSBModel)) {
    return new SCSBModel(obj);
  }

  this.initializeSCSBModel = (obj) => {
    if (typeof obj === 'object') {
      return obj.length > 1 ? this.createModelFromArray(obj) : this.createModelFromObject(obj);
    }
    // Object is not defined, throw error
  };

  this.createModelFromArray = (obj) => {
    console.log('createModelFromArray function');
  };

  this.createModelFromObject = (obj) => {
    console.log('createModelFromObject function');
    const singleObject = obj[0];
    console.log(singleObject);
    const scsbSchema = {};

    if (singleObject.record && singleObject.record !== '') {
      // Fetch record data via Item Service API
    }

    console.log('scsbSchema', scsbSchema);
  };

  return this.initializeSCSBModel(obj);
}

module.exports = SCSBModel;
