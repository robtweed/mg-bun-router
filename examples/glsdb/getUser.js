const handler = function(messageObj, finished) {

  let id = messageObj.data.params.id;

  /*

    // using the low-level native mg-dbx-napi APIs

  let person = this.use("Person");
  let exists = +person.defined('data', id);
  if (exists !== 0) {
    let firstName = person.get('data', id, 'firstName');
    let lastName = person.get('data', id, 'lastName');
    finished({
      document: {
        firstName: firstName,
        lastName: lastName
      }
    });
  }
  else {
    return finished({error: 'No record exists with id ' + id});
  }

  */

  // Using glsdb

  let person = new this.glsdb.node('Person.data.' + id);

  if (person.exists) {
    return finished({
      document: person.document
    });
  }
  else {
    return finished({error: 'No record exists with id ' + id});
  }

};

export {handler};