import Rules from '../src/index'
import * as yup from 'yup';

describe('Object types', () => {
    describe('casting', () => {
        let inst;

        beforeEach(() => {
            inst = new Rules([
                ['object', {
                    num: [
                        ['number']
                    ],
                    str: [
                        ['string']
                    ],
                    arr: [
                        ['array'],
                        ['of', [
                            ['number']
                        ]]
                    ],
                    dte: [
                        ['date']
                    ],
                    nested: [
                        ['object'],
                        ['shape', {
                            str: [
                                ['string']
                            ]
                        }]
                    ],
                    arrNested: [
                        ['array'],
                        ['of', [
                            ['object'],
                            ['shape', {
                                num: [
                                    ['number']
                                ]
                            }]
                        ]]
                    ],
                    stripped: [
                        ['string'],
                        ['strip']
                    ]
                }]
            ]).toYup()
        });

        it('should parse json strings', () => {
            new Rules([
                    ['object', {
                        hello: [
                            ['number']
                        ]
                    }]
                ]).toYup()
                .cast('{ "hello": "5" }')
                .should.eql({
                    hello: 5,
                });
        });

        it('should return null for failed casts', () => {
            expect(new Rules([
                ['object']
            ]).toYup().cast('dfhdfh', {
                assert: false
            })).to.equal(null);
        });

        it('should recursively cast fields', () => {
            let obj = {
                num: '5',
                str: 'hello',
                arr: ['4', 5],
                dte: '2014-09-23T19:25:25Z',
                nested: {
                    str: 5
                },
                arrNested: [{
                    num: 5
                }, {
                    num: '5'
                }],
            };

            const cast = inst.cast(obj);

            cast.should.eql({
                num: 5,
                str: 'hello',
                arr: [4, 5],
                dte: new Date(1411500325000),
                nested: {
                    str: '5'
                },
                arrNested: [{
                    num: 5
                }, {
                    num: 5
                }],
            });

            cast.arrNested[0].should.equal(obj.arrNested[0], 'should be kept as is');
        });

        it('should return the same object if all props are already cast', () => {
            let obj = {
                num: 5,
                str: 'hello',
                arr: [4, 5],
                dte: new Date(1411500325000),
                nested: {
                    str: '5'
                },
                arrNested: [{
                    num: 5
                }, {
                    num: 5
                }],
            };

            inst.cast(obj).should.equal(obj);
        });
    });

    describe('validation', () => {
        let inst, obj;

        beforeEach(() => {
            inst = new Rules([
                ['object', {
                    num: [
                        ['number'],
                        ['max', 4]
                    ],
                    str: [
                        ['string']
                    ],
                    arr: [
                        ['array'],
                        ['of', [
                            ['number'],
                            ['max', 6]
                        ]]
                    ],
                    dte: [
                        ['date']
                    ],
                    nested: [
                        ['object'],
                        ['shape', {
                            str: [
                                ['string'],
                                ['min', 3]
                            ]
                        }],
                        ['required']
                    ],
                    arrNested: [
                        ['array'],
                        ['of', [
                            ['object'],
                            ['shape', {
                                num: [
                                    ['number']
                                ]
                            }]
                        ]]
                    ],
                    stripped: [
                        ['string'],
                        ['strip']
                    ]
                }]
            ]).toYup()

            obj = {
                num: '4',
                str: 'hello',
                arr: ['4', 5, 6],
                dte: '2014-09-23T19:25:25Z',
                nested: {
                    str: 5
                },
                arrNested: [{
                    num: 5
                }, {
                    num: '2'
                }],
            };
        });

        it('should run validations recursively', async () => {
            await inst
                .isValid()
                .should.eventually.equal(true);

            let error = await inst.validate(obj).should.be.rejected;

            error.errors.length.should.equal(1);
            error.errors[0].should.contain('nested.str');

            obj.nested.str = 'hello';
            obj.arr[1] = 8;

            error = await inst.validate(obj).should.be.rejected;
            error.errors[0].should.contain('arr[1]');
        });

        it('should prevent recursive casting', async () => {
            let castSpy = sinon.spy(yup.string.prototype, '_cast');

            inst = new Rules([
                ['object', {
                    field: [
                        ['string']
                    ]
                }]
            ]).toYup()

            let value = await inst.validate({
                field: 5
            });

            value.field.should.equal('5');

            castSpy.should.have.been.called.once;

            yup.string.prototype._cast.restore();
        });

        it('should respect strict for nested values', async () => {
            inst = new Rules([
                ['object', {
                    field: [
                        ['string']
                    ]
                }],
                ['strict']
            ]).toYup()

            let err = await inst.validate({
                field: 5
            }).should.be.rejected;

            err.message.should.match(/must be a `string` type/);
        });

        it('should respect child schema with strict()', async () => {
            inst = new Rules([
                ['object', {
                    field: [
                        ['number'],
                        ['strict']
                    ]
                }]
            ]).toYup()

            let err = await inst.validate({
                field: '5'
            }).should.be.rejected;

            err.message.should.match(/must be a `number` type/);

            inst.cast({
                field: '5'
            }).should.eql({
                field: 5
            });

            new Rules([
                ['object', {
                    port: [
                        ['number'],
                        ['strict'],
                        ['integer']
                    ]
                }]
            ]).toYup()

            err = await new Rules([
                    ['object', {
                        port: [
                            ['number'],
                            ['strict'],
                            ['integer']
                        ]
                    }]
                ]).toYup()
                .validate({
                    port: 'asdad'
                })
                .should.be.rejected;
        });

        it('should handle custom validation', async () => {
            let inst = new Rules([
                    ['object'],
                    ['shape', {
                        prop: [
                            ['mixed']
                        ],
                        other: [
                            ['mixed']
                        ]
                    }]
                ]).toYup()
                .test('test', '${path} oops', () => false);

            let err = await inst.validate({}).should.be.rejected;

            err.errors[0].should.equal('this oops');
        });

        it('should not clone during validating', async function() {
            let base = yup.mixed.prototype.clone;

            yup.mixed.prototype.clone = function(...args) {
                if (!this._mutate) throw new Error('should not call clone');

                return base.apply(this, args);
            };

            try {
                await inst.validate({
                    nested: {
                        str: 'jimmm'
                    },
                    arrNested: [{
                        num: 5
                    }, {
                        num: '2'
                    }],
                });
                await inst.validate({
                    nested: {
                        str: 5
                    },
                    arrNested: [{
                        num: 5
                    }, {
                        num: '2'
                    }],
                });
            } catch (err) {
                /* ignore */
            } finally {
                //eslint-disable-line
                yup.mixed.prototype.clone = base;
            }
        });
    });

    it('should pass options to children', function() {
        new Rules([
                ['object', {
                    names: [
                        ['object', {
                            first: [
                                ['string']
                            ]
                        }]
                    ]
                }]
            ]).toYup()
            .cast({
                extra: true,
                names: {
                    first: 'john',
                    extra: true
                },
            }, {
                stripUnknown: true
            }, )
            .should.eql({
                names: {
                    first: 'john',
                },
            });
    });

    it('should call shape with constructed with an arg', () => {
        let inst = new Rules([
            ['object', {
                prop: [
                    ['mixed']
                ]
            }]
        ]).toYup();

        expect(inst.fields.prop).to.exist;
    });

    describe('object defaults', () => {
        let objSchema;

        beforeEach(() => {
            objSchema = new Rules([
                ['object', {
                    nest: [
                        ['object', {
                            str: [
                                ['string'],
                                ['default', 'hi']
                            ]
                        }]
                    ]
                }]
            ]).toYup()
        });

        it('should expand objects by default', () => {
            objSchema.default().should.eql({
                nest: {
                    str: 'hi'
                },
            });
        });

        it('should accept a user provided default', () => {
            objSchema = objSchema.default({
                boom: 'hi'
            });

            objSchema.default().should.eql({
                boom: 'hi',
            });
        });

        it('should add empty keys when sub schema has no default', () => {
            new Rules([
                    ['object', {
                        str: [
                            ['string']
                        ],
                        nest: [
                            ['object', {
                                str: [
                                    ['string']
                                ]
                            }]
                        ]
                    }]
                ]).toYup()
                .default()
                .should.eql({
                    nest: {
                        str: undefined
                    },
                    str: undefined,
                });
        });

        it('should create defaults for missing object fields', () => {
            new Rules([
                    ['object', {
                        prop: [
                            ['mixed']
                        ],
                        other: [
                            ['object', {
                                x: [
                                    ['object', {
                                        b: [
                                            ['string']
                                        ]
                                    }]
                                ]
                            }]
                        ]
                    }]
                ]).toYup()
                .cast({
                    prop: 'foo'
                })
                .should.eql({
                    prop: 'foo',
                    other: {
                        x: {
                            b: undefined
                        }
                    },
                });
        });
    });

    it('should handle empty keys', () => {
        let inst = new Rules([
            ['object', {
                prop: [
                    ['mixed']
                ]
            }]
        ]).toYup();

        return Promise.all([
            inst
            .isValid({})
            .should.eventually.equal(true),

            inst
            .shape({
                prop: yup.mixed().required()
            })
            .isValid({})
            .should.eventually.equal(false),
        ]);
    });

    it('should handle default null for object', () => {
        let inst = new Rules([
            ['object', {
                other: [
                    ['bool']
                ]
            }],
            ['default', null]
        ]).toYup()

        expect(inst.concat(new Rules([
            ['object']
        ]).toYup()).default()).to.equal(null);
    })

    it('should work with noUnknown', () => {
        let inst = new Rules([
            ['object', {
                prop: [
                    ['mixed']
                ],
                other: [
                    ['mixed']
                ]
            }]
        ]).toYup();

        return Promise.all([
            inst
            .noUnknown('hi')
            .validate({
                extra: 'field'
            }, {
                strict: true
            })
            .should.be.rejected.then(err => {
                err.errors[0].should.equal('hi');
            }),

            inst
            .noUnknown()
            .validate({
                extra: 'field'
            }, {
                strict: true
            })
            .should.be.rejected.then(err => {
                err.errors[0].should.be.a('string');
            }),
        ]);
    });

    // Not working without yup-schema
    // it('should work with noUnknown override', async () => {]]
    //     let inst = new Rules([['object'], ['shape', {
    //         prop: [['mixed']]
    //     }], ['noUnknown'], ['noUnknown', false]]).toYup();
    //
    //     await inst.validate({
    //         extra: 'field'
    //     }).should.become({
    //         extra: 'field'
    //     });
    // });

    it('should strip specific fields', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                prop: [
                    ['mixed'],
                    ['strip', false]
                ],
                other: [
                    ['mixed'],
                    ['strip']
                ]
            }]
        ]).toYup()

        inst.cast({
            other: 'boo',
            prop: 'bar'
        }).should.eql({
            prop: 'bar',
        });
    });

    it('should handle field striping with `when`', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                other: [
                    ['bool']
                ],
                prop: [
                    ['mixed'],
                    ['when', 'other', {
                        is: true,
                        then: s => s.strip()
                    }]
                ],
            }]
        ]).toYup()

        inst.cast({
            other: true,
            prop: 'bar'
        }).should.eql({
            other: true,
        });
    });

    it('should allow refs', async function() {
        let schema = new Rules([
            ['object', {
                quz: yup.ref('baz'),
                baz: yup.ref('foo.bar'),
                foo: [
                    ['object', {
                        bar: [
                            ['string']
                        ]
                    }]
                ],
                x: yup.ref('$x')
            }]
        ]).toYup()

        let value = await schema.validate({
            foo: {
                bar: 'boom'
            },
        }, {
            context: {
                x: 5
            }
        }, );

        //console.log(value)
        value.should.eql({
            foo: {
                bar: 'boom',
            },
            baz: 'boom',
            quz: 'boom',
            x: 5,
        });
    });

    it('should allow refs with abortEarly false', async () => {
        let schema = new Rules([
            ['object'],
            ['shape', {
                field: [
                    ['string']
                ],
                dupField: yup.ref('field')
            }]
        ]).toYup()

        let actual = await schema
            .validate({
                field: 'test',
            }, {
                abortEarly: false
            }, )
            .should.not.be.rejected;

        actual.should.eql({
            field: 'test',
            dupField: 'test'
        });
    });

    describe('lazy evaluation', () => {
        let types = {
            string: new Rules([
                ['string']
            ]).toYup(),
            number: new Rules([
                ['number']
            ]).toYup(),
        };

        it('should be cast-able', () => {
            let inst = new Rules([
                ['lazy', () => new Rules([
                    ['number']
                ]).toYup()]
            ]).toYup()

            inst.cast.should.be.a('function');
            inst.cast('4').should.equal(4);
        });

        it('should be validatable', async () => {
            let inst = new Rules([
                ['lazy', () =>
                    new Rules([
                        ['string'],
                        ['trim', 'trim me!'],
                        ['strict']
                    ]).toYup()
                ]
            ]).toYup()

            inst.validate.should.be.a('function');

            try {
                await inst.validate('  john  ');
            } catch (err) {
                err.message.should.equal('trim me!');
            }
        });

        it('should resolve to schema', () => {
            let inst = new Rules([
                ['object', {
                    nested: [
                        ['lazy', () => inst]
                    ],
                    x: [
                        ['object', {
                            y: [
                                ['lazy', () => inst]
                            ]
                        }]
                    ]
                }]
            ]).toYup();

            new Rules([
                ['reach', inst, 'nested']
            ]).toYup().should.equal(inst);
            new Rules([
                ['reach', inst, 'x.y']
            ]).toYup().should.equal(inst);
        });

        it('should be passed the value', done => {
            let inst = new Rules([
                ['object', {
                    nested: [
                        ['lazy', value => {
                            value.should.equal('foo');
                            done();
                            return new Rules([
                                ['string']
                            ]).toYup();
                        }]
                    ],
                }]
            ]).toYup();

            inst.cast({
                nested: 'foo'
            });
        });

        it('should be passed the options', done => {
            let opts = {};
            let inst = new Rules([
                ['lazy', (_, options) => {
                    options.should.equal(opts);
                    done();
                    return new Rules([
                        ['string']
                    ]).toYup();
                }]
            ]).toYup()

            inst.cast({
                nested: 'foo'
            }, opts);
        });

        it('should always return a schema', () => {
            (() => new Rules([
                    ['lazy', () => {}]
                ]).toYup()
                .cast()).should.throw(/must return a valid schema/);
        });

        it('should set the correct path', async () => {
            let inst = new Rules([
                ['object', {
                    str: [
                        ['string'],
                        ['required'],
                        ['nullable']
                    ],
                    nested: [
                        ['lazy', () => inst.default(undefined)]
                    ]
                }]
            ]).toYup()

            let value = {
                nested: {
                    str: null
                },
                str: 'foo',
            };

            try {
                await inst.validate(value, {
                    strict: true
                });
            } catch (err) {
                err.path.should.equal('nested.str');
                err.message.should.match(/required/);
            }
        });

        it('should resolve array sub types', async () => {
            let inst = new Rules([
                ['object', {
                    str: [
                        ['string'],
                        ['required'],
                        ['nullable']
                    ],
                    nested: [
                        ['array'],
                        ['of', [
                            ['lazy', () => inst.default(undefined)]
                        ]]
                    ]
                }]
            ]).toYup()

            let value = {
                nested: [{
                    str: null
                }],
                str: 'foo',
            };

            try {
                await inst.validate(value, {
                    strict: true
                });
            } catch (err) {
                err.path.should.equal('nested[0].str');
                err.message.should.match(/required/);
            }
        });

        it('should resolve for each array item', async () => {
            let inst = new Rules([
                ['array'],
                ['of', [
                    ['lazy', value => types[typeof value]]
                ]]
            ]).toYup()

            let val = await inst.validate(['john', 4], {
                strict: true
            });

            val.should.eql(['john', 4]);
        });
    });

    it('should respect abortEarly', () => {
        let inst = new Rules([
            ['object', {
                nest: [
                    ['object', {
                        str: [
                            ['string'],
                            ['required']
                        ]
                    }],
                    ['test', 'name', 'oops', () => false]
                ]
            }]
        ]).toYup()

        return Promise.all([
            inst
            .validate({
                nest: {
                    str: ''
                }
            })
            .should.be.rejected
            .then(err => {
                err.value.should.eql({
                    nest: {
                        str: ''
                    }
                });
                err.errors.length.should.equal(1);
                err.errors.should.eql(['oops']);

                err.path.should.equal('nest');
            }),

            inst
            .validate({
                nest: {
                    str: ''
                }
            }, {
                abortEarly: false
            })
            .should.be.rejected
            .then(err => {
                err.value.should.eql({
                    nest: {
                        str: ''
                    }
                });
                err.errors.length.should.equal(2);
                err.errors.should.eql(['nest.str is a required field', 'oops']);
            }),
        ]);
    });

    it('should sort errors by insertion order', async () => {
        let inst = new Rules([
            ['object', {
                foo: [
                    ['string'],
                    ['when', 'bar', () => new Rules([
                        ['string'],
                        ['min', 5]
                    ]).toYup()]
                ],
                bar: [
                    ['string'],
                    ['required']
                ]
            }]
        ]).toYup()

        let err = await inst
            .validate({
                foo: 'foo'
            }, {
                abortEarly: false
            })
            .should.rejected;

        err.errors.should.eql([
            'foo must be at least 5 characters',
            'bar is a required field',
        ]);
    });

    it('should respect recursive', () => {
        let inst = new Rules([
            ['object', {
                nest: [
                    ['object', {
                        str: [
                            ['string'],
                            ['required']
                        ]
                    }]
                ]
            }],
            ['test', 'name', 'oops', () => false]
        ]).toYup()

        let val = {
            nest: {
                str: null
            }
        };

        return Promise.all([
            inst
            .validate(val, {
                abortEarly: false
            })
            .should.be.rejected.then(err => {
                err.errors.length.should.equal(2);
            }),

            inst
            .validate(val, {
                abortEarly: false,
                recursive: false
            })
            .should.be.rejected.then(err => {
                err.errors.length.should.equal(1);
                err.errors.should.eql(['oops']);
            }),
        ]);
    });

    it('should alias or move keys', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                myProp: [
                    ['mixed']
                ],
                Other: [
                    ['mixed']
                ]
            }],
            ['from', 'prop', 'myProp'],
            ['from', 'other', 'Other', true]
        ]).toYup()

        inst
            .cast({
                prop: 5,
                other: 6
            })
            .should.eql({
                myProp: 5,
                other: 6,
                Other: 6
            });
    });

    it('should alias nested keys', () => {
        let inst = new Rules([
            ['object', {
                foo: [
                    ['object', {
                        bar: [
                            ['string']
                        ]
                    }]
                ]
            }],
            ['from', 'foo.bar', 'foobar', true]
        ]).toYup()

        inst
            .cast({
                foo: {
                    bar: 'quz'
                }
            })
            .should.eql({
                foobar: 'quz',
                foo: {
                    bar: 'quz'
                }
            });
    });

    it('should not move keys when it does not exist', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                myProp: [
                    ['mixed']
                ]
            }],
            ['from', 'prop', 'myProp']
        ]).toYup()

        inst.cast({
            myProp: 5
        }).should.eql({
            myProp: 5
        });

        inst.cast({
            myProp: 5,
            prop: 7
        }).should.eql({
            myProp: 7
        });
    });

    it('should handle conditionals', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                noteDate: [
                    ['number'],
                    ['when', 'stats.isBig', {
                        is: true,
                        then: [
                            ['number'],
                            ['min', 5]
                        ]
                    }],
                    ['when', 'other', function(v) {
                        if (v === 4) return this.max(6)
                    }]
                ],
                stats: [
                    ['object', {
                        isBig: [
                            ['bool']
                        ]
                    }]
                ],
                other: [
                    ['number'],
                    ['min', 1],
                    ['when', 'stats', {
                        is: 5,
                        then: [
                            ['number']
                        ]
                    }]
                ]
            }]
        ]).toYup()

        return Promise.all([
            inst
            .isValid({
                stats: {
                    isBig: true
                },
                rand: 5,
                noteDate: 7,
                other: 4
            })
            .should.eventually.equal(false),
            inst
            .isValid({
                stats: {
                    isBig: true
                },
                noteDate: 1,
                other: 4
            })
            .should.eventually.equal(false),

            inst
            .isValid({
                stats: {
                    isBig: true
                },
                noteDate: 7,
                other: 6
            })
            .should.eventually.equal(true),
            inst
            .isValid({
                stats: {
                    isBig: true
                },
                noteDate: 7,
                other: 4
            })
            .should.eventually.equal(false),

            inst
            .isValid({
                stats: {
                    isBig: false
                },
                noteDate: 4,
                other: 4
            })
            .should.eventually.equal(true),

            inst
            .isValid({
                stats: {
                    isBig: true
                },
                noteDate: 1,
                other: 4
            })
            .should.eventually.equal(false),
            inst
            .isValid({
                stats: {
                    isBig: true
                },
                noteDate: 6,
                other: 4
            })
            .should.eventually.equal(true),
        ]);
    });

    it('should allow opt out of topo sort on specific edges', () => {
        (function() {
            new Rules([
                ['object'],
                ['shape', {
                    orgID: [
                        ['number'],
                        ['when', 'location', function(v) {
                            if (v == null) return this.required();
                        }]
                    ],
                    location: [
                        ['string'],
                        ['when', 'orgID', function(v) {
                            if (v == null) return this.required();
                        }]
                    ],
                }]
            ]).toYup()
        }.should.throw('Cyclic dependency, node was:"location"'));
        (function() {
            new Rules([
                ['object'],
                ['shape', {
                        orgID: [
                            ['number'],
                            ['when', 'location', function(v) {
                                if (v == null) return this.required();
                            }]
                        ],
                        location: [
                            ['string'],
                            ['when', 'orgID', function(v) {
                                if (v == null) return this.required();
                            }]
                        ],
                    },
                    [
                        ['location', 'orgID']
                    ]
                ]
            ]).toYup()
        }.should.not.throw());
    });

    it('should use correct default when concating', () => {
        let inst = new Rules([
            ['object', {
                other: [
                    ['bool']
                ]
            }],
            ['default', undefined]
        ]).toYup()

        expect(inst.concat(new Rules([
            ['object']
        ]).toYup()).default()).to.equal(undefined);

        expect(inst.concat(new Rules([
            ['object'],
            ['default', {}]
        ]).toYup()).default()).to.eql({});
    });

    it('should handle nested conditionals', () => {
        let countSchema = new Rules([
            ['number'],
            ['when', 'isBig', {
                is: true,
                then: [
                    ['number'],
                    ['min', 5]
                ]
            }]
        ]).toYup();

        let inst = new Rules([
            ['object', {
                other: [
                    ['bool']
                ],
                stats: [
                    ['object', {
                        isBig: [
                            ['bool']
                        ],
                        count: countSchema,
                    }],
                    ['default', undefined],
                    ['when', 'other', {
                        is: true,
                        then: [
                            ['object'],
                            ['required']
                        ]
                    }]
                ]
            }]
        ]).toYup()

        return Promise.all([
            inst
            .validate({
                stats: undefined,
                other: true
            })
            .should.be.rejected.then(err => {
                err.errors[0].should.contain('required');
            }),

            inst
            .validate({
                stats: {
                    isBig: true,
                    count: 3
                },
                other: true
            })
            .should.be.rejected.then(err => {
                err.errors[0].should.contain('must be greater than or equal to 5');
            }),

            inst
            .validate({
                stats: {
                    isBig: true,
                    count: 10
                },
                other: true
            })
            .should.be.fulfilled.then(value => {
                value.should.deep.equal({
                    stats: {
                        isBig: true,
                        count: 10
                    },
                    other: true,
                });
            }),

            countSchema
            .validate(10, {
                context: {
                    isBig: true
                }
            })
            .should.be.fulfilled.then(value => {
                value.should.deep.equal(10);
            }),
        ]);
    });

    it('should camelCase keys', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                conStat: [
                    ['number']
                ],
                caseStatus: [
                    ['number']
                ],
                hiJohn: [
                    ['number']
                ]
            }],
            ['camelCase']
        ]).toYup()

        inst
            .cast({
                CON_STAT: 5,
                CaseStatus: 6,
                'hi john': 4
            })
            .should.eql({
                conStat: 5,
                caseStatus: 6,
                hiJohn: 4
            });

        expect(inst.nullable().cast(null)).to.equal(null);
    });
    //
    // // it('should camelCase with leading underscore', () => {
    // //   let inst = object().camelCase()
    // //
    // //   inst
    // //     .cast({ CON_STAT: 5, __isNew: true, __IS_FUN: true })
    // //     .should
    // //     .eql({ conStat: 5, __isNew: true, __isFun: true })
    // // })
    //
    it('should CONSTANT_CASE keys', () => {
        let inst = new Rules([
            ['object'],
            ['shape', {
                CON_STAT: [
                    ['number']
                ],
                CASE_STATUS: [
                    ['number']
                ],
                HI_JOHN: [
                    ['number']
                ]
            }],
            ['constantCase']
        ]).toYup()

        inst
            .cast({
                conStat: 5,
                CaseStatus: 6,
                'hi john': 4
            })
            .should.eql({
                CON_STAT: 5,
                CASE_STATUS: 6,
                HI_JOHN: 4
            });

        expect(inst.nullable().cast(null)).to.equal(null);
    });

    xit('should handle invalid shapes better', async () => {
        var schema = new Rules([
            ['object'],
            ['shape', {
                permissions: undefined
            }]
        ]).toYup();

        expect(
            await schema.isValid({
                permissions: []
            }, {
                abortEarly: false
            }),
        ).to.equal(true);
    });
});
