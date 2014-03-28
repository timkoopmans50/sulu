/*
 * This file is part of the Sulu CMS.
 *
 * (c) MASSIVE ART WebServices GmbH
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

define([], function() {

    'use strict';

    var permissions = ['view', 'add', 'edit', 'delete', 'archive', 'live', 'security'],
        permissionTitles = [
            'security.permissions.view',
            'security.permissions.add',
            'security.permissions.edit',
            'security.permissions.delete',
            'security.permissions.archive',
            'security.permissions.live',
            'security.permissions.security'
        ],
        permissionData,
        matrixContainerSelector = '#matrix-container',
        matrixSelector = '#matrix',
        formSelector = '#role-form',
        loadedContexts,

    // FIXME move to this.*
        currentType,
        currentState;

    return {

        name: 'Sulu Security Role Form',

        view: true,

        templates: ['/admin/security/template/role/form'],

        initialize: function() {
            this.saved = true;
            this.selectedSystem = '';
            permissionData = this.options.data.permissions;

            // wait for dropdown to initialize, then get the value and continue
            this.sandbox.on('husky.select.system.initialize', function() {
                this.sandbox.emit('husky.select.system.getChecked', function(system) {
                    this.selectedSystem = system[0];

                    this.initializeMatrix();
                    this.initializeValidation();

                    this.bindDOMEvents();
                    this.bindCustomEvents();

                    this.setHeaderBar(true);
                    this.listenForChange();
                }.bind(this));
            }.bind(this));

            this.render();
        },

        bindDOMEvents: function() {
            this.sandbox.dom.on(this.$el, 'change', this.setGod.bind(this), '#god');
        },

        bindCustomEvents: function() {
            this.sandbox.on('husky.matrix.changed', function(data) {
                this.changePermission(data);
            }.bind(this));

            this.sandbox.on('sulu.edit-toolbar.save', function() {
                this.save();
            }.bind(this));

            this.sandbox.on('sulu.edit-toolbar.delete', function() {
                this.sandbox.emit('sulu.role.delete', this.sandbox.dom.val('#id'));
            }.bind(this));

            this.sandbox.on('sulu.role.saved', function(id) {
                this.options.data.id = id;
                this.setHeaderBar(true);
            }, this);

            // back to list
            this.sandbox.on('sulu.edit-toolbar.back', function() {
                this.sandbox.emit('sulu.roles.list');
            }, this);

            this.sandbox.on('husky.dropdown.multiple.select.system.selected.item', function(value) {
                this.selectedSystem = value;
                this.initializeMatrix();
            }.bind(this));
        },

        initializeValidation: function() {
            this.sandbox.form.create(formSelector);
        },

        initializeMatrix: function() {
            // create new matrix div, and stop old matrix
            var $matrix = this.sandbox.dom.createElement('<div id="matrix" class="loading"/>'),
                contextHeadlines, matrixData,

            // create required data for matrix
                createMatrixData = function(context) {
                    // vertical axis of matrix
                    var contextDataKey,
                        matched = false;
                    contextHeadlines.push(context.split('.').splice(2).join('.')); // TODO capitalize first letter
                    permissionData.forEach(function(contextData) {
                        // horizontal axis of matrix
                        if (contextData.context === context) {
                            matched = true;
                            contextDataKey = matrixData.push([]) - 1;
                            permissions.forEach(function(permission) {
                                matrixData[contextDataKey].push(contextData.permissions[permission]);
                            });
                        }
                    });

                    // add an empty array to data, if no data is given for the current context
                    if (!matched) {
                        matrixData.push([]);
                    }
                };

            this.sandbox.stop(matrixSelector);
            this.sandbox.dom.append(matrixContainerSelector, $matrix);

            // load all the contexts from the selected module
            this.sandbox.util.ajax({
                url: '/admin/contexts?system=' + this.selectedSystem
            })
                .done(function(data) {
                    data = JSON.parse(data);
                    loadedContexts = data;
                    for (var module in data) {
                        if (data.hasOwnProperty(module)) {
                            // create a matrix for every module

                            contextHeadlines = [];
                            matrixData = [];

                            data[module].forEach(createMatrixData);

                            this.sandbox.start([
                                {
                                    name: 'matrix@husky',
                                    options: {
                                        el: matrixSelector,
                                        captions: {
                                            general: module,
                                            type: this.sandbox.translate('security.roles.section'),
                                            horizontal: this.sandbox.translate('security.roles.permissions'),
                                            all: this.sandbox.translate('security.roles.all'),
                                            none: this.sandbox.translate('security.roles.none'),
                                            vertical: contextHeadlines
                                        },
                                        values: {
                                            vertical: data[module],
                                            horizontal: permissions,
                                            titles: this.sandbox.translateArray(permissionTitles)
                                        },
                                        data: matrixData
                                    }
                                }
                            ]);

                            this.sandbox.dom.removeClass($matrix, 'loading');
                        }
                    }
                }.bind(this));
        },

        setGod: function() {
            if (!!this.sandbox.dom.is('#god', ':checked')) {
                this.sandbox.emit('husky.matrix.set-all');
            } else {
                this.sandbox.emit('husky.matrix.unset-all');
            }
        },

        changePermission: function(data) {
            if (typeof(data.value) === 'string') {
                this.setPermission(data.section, data.value, data.activated);
            } else {
                this.sandbox.dom.each(data.value, function(key, value) {
                    this.setPermission(data.section, value, data.activated);
                }.bind(this));
            }

            if (!data.activated) {
                // unset god status as soon as one permission is removed
                this.sandbox.dom.attr('#god', { checked: false });
            }
        },

        setPermission: function(section, value, activated) {
            var contextKey = this.getContextKey(section);
            if (!!permissionData[contextKey]) {
                // just update the permission value, if the permission already exists
                permissionData[contextKey].permissions[value] = activated;
            } else {
                //create a new entry for the permissions, and set the appropriate values
                permissionData[contextKey] = {};
                permissionData[contextKey].context = section;
                permissionData[contextKey].permissions = {};
                permissionData[contextKey].permissions[value] = activated;
            }
        },

        getContextKey: function(search) {
            var contextKey = permissionData.length;

            permissionData.forEach(function(contextData, key) {
                if (contextData.context === search) {
                    contextKey = key;
                }
            });

            return contextKey;
        },

        save: function() {
            if (!!this.sandbox.form.validate(formSelector)) {
                // FIXME  Use datamapper instead
                var data = {
                    id: this.sandbox.dom.val('#id'),
                    name: this.sandbox.dom.val('#name'),
                    system: this.selectedSystem,
                    permissions: permissionData
                };

                this.sandbox.emit('sulu.roles.save', data);
            }
        },

        render: function() {
            this.$el.html(this.renderTemplate('/admin/security/template/role/form', {data: this.options.data}));
            //starts the dropdown-component
            this.sandbox.start(this.$el);
        },

        // @var Bool saved - defines if saved state should be shown
        setHeaderBar: function(saved) {
            if (saved !== this.saved) {
                var type = (!!this.options.data && !!this.options.data.id) ? 'edit' : 'add';
                this.sandbox.emit('sulu.edit-toolbar.content.state.change', type, saved, true);
            }
            this.saved = saved;
        },

        listenForChange: function() {
            this.sandbox.dom.on('#role-form', 'change', function() {
                this.setHeaderBar(false);
            }.bind(this), 'select, input');
            this.sandbox.dom.on('#role-form', 'keyup', function() {
                this.setHeaderBar(false);
            }.bind(this), 'input');
            this.sandbox.on('husky.matrix.changed', function() {
                this.setHeaderBar(false);
            }.bind(this));
        }
    };
});
